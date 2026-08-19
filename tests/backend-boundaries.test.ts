import { describe, expect, it, vi } from "vitest";

import { POST as postRoutes } from "@/app/api/routes/route";
import { ApiError, apiErrorResponse } from "@/lib/api-errors";
import {
  moderationBlockMessage,
  routeTextForModeration,
} from "@/lib/moderation";
import { routesAreDiverse } from "@/lib/openai/generate-routes";
import { validateTextSafety } from "@/evals/validators";
import { parseJsonRequest } from "@/lib/request";
import {
  assertBrowserSafeActivity,
  assertNoLearnerProfiling,
  assertSafetyIdentifier,
} from "@/lib/safety";
import { routesRequestSchema } from "@/lib/schemas";

const validRoutes = [
  {
    id: "pressure-model",
    title: "Model the Pressure",
    hook: "Build a mental model of depth, pressure, and human limits.",
    lens: "understand" as const,
    activityType: "causal model",
    estimatedMinutes: 10,
    iconKey: "waves",
  },
  {
    id: "habitat-design",
    title: "Design the Habitat",
    hook: "Balance life support, food, energy, and maintenance for 100 people.",
    lens: "create" as const,
    activityType: "systems design",
    estimatedMinutes: 10,
    iconKey: "blueprint",
  },
  {
    id: "ocean-tradeoffs",
    title: "Challenge the Tradeoffs",
    hook: "Test whether permanent settlement can avoid harming ocean ecosystems.",
    lens: "challenge" as const,
    activityType: "evidence critique",
    estimatedMinutes: 10,
    iconKey: "leaf",
  },
];

function streamingJsonRequest(
  chunks: Uint8Array[],
  onCancel = vi.fn(),
): { request: Request; pullCount: () => number; onCancel: typeof onCancel } {
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[pulls];
        pulls += 1;
        if (chunk) {
          controller.enqueue(chunk);
        } else {
          controller.close();
        }
      },
      cancel: onCancel,
    },
    { highWaterMark: 0 },
  );

  return {
    request: new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" }),
    pullCount: () => pulls,
    onCancel,
  };
}

describe("backend request boundary", () => {
  it("parses and validates a JSON request without retaining unknown fields", async () => {
    const request = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "  Could humans live underwater?  ",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: "wl_1234567890abcdef",
      }),
    });

    const parsed = await parseJsonRequest(request, routesRequestSchema);
    expect(parsed.question).toBe("Could humans live underwater?");
  });

  it("parses a valid streamed JSON body without Content-Length", async () => {
    const encoded = new TextEncoder().encode(
      JSON.stringify({
        question: "Could a café operate underwater?",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: "wl_1234567890abcdef",
      }),
    );
    const splitInsideMultibyteCharacter = encoded.indexOf(0xc3) + 1;
    const { request, onCancel } = streamingJsonRequest([
      encoded.slice(0, splitInsideMultibyteCharacter),
      encoded.slice(splitInsideMultibyteCharacter),
    ]);

    expect(request.headers.get("content-length")).toBeNull();
    await expect(
      parseJsonRequest(request, routesRequestSchema),
    ).resolves.toMatchObject({
      question: "Could a café operate underwater?",
    });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels an oversized streamed body before reading to EOF", async () => {
    const { request, pullCount, onCancel } = streamingJsonRequest([
      new Uint8Array(64 * 1024).fill(0x20),
      new Uint8Array([0x20]),
    ]);

    expect(request.headers.get("content-length")).toBeNull();
    await expect(
      parseJsonRequest(request, routesRequestSchema),
    ).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      status: 413,
    });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(pullCount()).toBe(2);
  });

  it("cancels a stalled streamed body when the route budget aborts", async () => {
    const onCancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          // Intentionally never enqueue or close.
        },
        cancel: onCancel,
      },
      { highWaterMark: 0 },
    );
    const request = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const controller = new AbortController();
    const reason = new DOMException("Request budget elapsed.", "TimeoutError");
    const pending = parseJsonRequest(
      request,
      routesRequestSchema,
      controller.signal,
    );

    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("returns field paths but never echoes invalid learner content", async () => {
    const privateLearnerText = "private learner response that must not echo";
    const request = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: privateLearnerText,
        level: "not-a-level",
        durationMinutes: 10,
        safetyIdentifier: "wl_1234567890abcdef",
      }),
    });

    let error: unknown;
    try {
      await parseJsonRequest(request, routesRequestSchema);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiError);
    const response = apiErrorResponse(error);
    const body = await response.text();
    expect(response.status).toBe(400);
    expect(body).toContain("level");
    expect(body).not.toContain(privateLearnerText);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects an invalid anonymous identifier before any model call", async () => {
    const request = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Could humans live underwater?",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: "learner@example.com",
      }),
    });

    const response = await postRoutes(request);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_REQUEST");
  });

  it("offers the seeded path when live generation is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const request = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Could humans live underwater?",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: "wl_1234567890abcdef",
      }),
    });

    try {
      const response = await postRoutes(request);
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(body.error).toEqual({
        code: "OPENAI_NOT_CONFIGURED",
        message:
          "Live generation is not configured yet. You can continue with the demo quest.",
        retryable: false,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps production seeded-only even when a key is present until release is explicit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "test-key-that-must-not-be-used");
    vi.stubEnv("WONDERLAB_LIVE_GENERATION_ENABLED", "false");
    const request = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Could humans live underwater?",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: "wl_1234567890abcdef",
      }),
    });

    try {
      const response = await postRoutes(request);
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(body.error).toEqual({
        code: "LIVE_GENERATION_DISABLED",
        message:
          "Live generation is not enabled for this deployment. You can continue with the demo quest.",
        retryable: false,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("still requires a server key after the production release lock passes", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "gpt-5.6");
    vi.stubEnv("WONDERLAB_LIVE_GENERATION_ENABLED", "true");
    vi.stubEnv(
      "WONDERLAB_LIVE_GENERATION_EXPIRES_AT",
      new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
    );
    const request = new Request("http://localhost/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: "Could humans live underwater?",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: "wl_1234567890abcdef",
      }),
    });

    try {
      const response = await postRoutes(request);
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(body.error).toEqual({
        code: "OPENAI_NOT_CONFIGURED",
        message:
          "Live generation is not configured yet. You can continue with the demo quest.",
        retryable: false,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("backend safety boundary", () => {
  it("accepts an anonymous stable identifier and rejects whitespace or PII-like forms", () => {
    expect(() => assertSafetyIdentifier("wl_1234567890abcdef")).not.toThrow();
    expect(() => assertSafetyIdentifier("learner@example.com")).toThrow(
      ApiError,
    );
  });

  it("allows a conceptual design but blocks dangerous hands-on instructions", () => {
    expect(() =>
      assertBrowserSafeActivity([
        "Design an underwater habitat on paper and compare pressure tradeoffs.",
      ]),
    ).not.toThrow();
    expect(() =>
      assertBrowserSafeActivity([
        "Build and test a pressure vessel using materials at home.",
      ]),
    ).toThrow(ApiError);
  });

  it("applies the same browser-safety boundary to generated framing and hints", () => {
    expect(() =>
      assertBrowserSafeActivity([
        "Do not build or test a pressure vessel; keep the activity entirely in the browser.",
      ]),
    ).not.toThrow();
    expect(() =>
      assertBrowserSafeActivity([
        "Compare habitat pressure using a diagram.",
        "Hint: build and test a pressure vessel using materials at home.",
      ]),
    ).toThrow(ApiError);
  });

  it("blocks a hazardous action and object split across generated fields", () => {
    expect(() =>
      assertBrowserSafeActivity([
        "Build and test a",
        "pressure vessel using materials at home.",
      ]),
    ).toThrow(ApiError);
  });

  it.each([
    [
      "negated instruction",
      [
        "Do not build or test a",
        "pressure vessel; use published data instead.",
      ],
    ],
    [
      "virtual activity",
      ["Test a computer", "simulation of a pressure vessel."],
    ],
  ])("allows the safe split-field %s control", (_caseName, activityParts) => {
    expect(() => assertBrowserSafeActivity(activityParts)).not.toThrow();
  });

  it.each([
    ["chemicals", "Mix bleach and ammonia in a container."],
    ["fire", "Start a fire with a lighter and compare two fuels."],
    ["heat", "Heat metal with a blowtorch and record the color change."],
    ["boiling liquid", "Boil water on a stove and record the temperature."],
    ["electricity", "Plug bare wires into an outlet and observe the result."],
    ["pressure vessels", "Build and test a pressure vessel at home."],
    ["weapons", "Use a kitchen knife to cut the test material."],
    ["ingestion", "Taste a wild mushroom and describe the flavor."],
    [
      "bodily experimentation",
      "Hold your breath underwater for as long as possible.",
    ],
    ["illegal activity", "Trespass after closing time to inspect the site."],
    ["dangerous locations", "Visit a cliff edge alone and measure the drop."],
    ["animal harm", "Dissect a frog to compare its organs."],
  ])("blocks the prohibited %s category", (_category, instruction) => {
    expect(() => assertBrowserSafeActivity([instruction])).toThrow(ApiError);
  });

  it.each([
    [
      "negated reminder",
      "Don't forget to build and test a pressure vessel at home.",
    ],
    [
      "negated hesitation",
      "Never hesitate to mix bleach and ammonia in a container.",
    ],
    [
      "missing supervision",
      "Without supervision build a circuit from a battery pack.",
    ],
    [
      "multiline direction",
      "Build and test a\npressure vessel using materials at home.",
    ],
    [
      "virtual pretext followed by instructions",
      "Use a browser diagram showing how to build a weapon at home.",
    ],
  ])(
    "does not let the %s wording hide a hazardous instruction",
    (_caseName, instruction) => {
      expect(() => assertBrowserSafeActivity([instruction])).toThrow(ApiError);
    },
  );

  it.each([
    "Compare published boiling-point data in the browser.",
    "Draw a circuit diagram without wiring or opening an outlet.",
    "Explain why learners should never visit a cliff edge.",
    "Do not boil water; compare a published data table instead.",
    "Never attempt to test a pressure vessel; use a diagram instead.",
    "Design an underwater habitat on paper and compare system tradeoffs.",
  ])("allows the safe conceptual or negated control: %s", (instruction) => {
    expect(() => assertBrowserSafeActivity([instruction])).not.toThrow();
  });

  it.each([
    "Use a browser diagram to compare how firearm policies differ.",
    "Build a causal model of how weapon regulations affect outcomes.",
    "Test a computer simulation of a pressure vessel.",
    "Use published data to compare gun violence trends.",
  ])("allows the safe virtual activity: %s", (instruction) => {
    expect(() => assertBrowserSafeActivity([instruction])).not.toThrow();
  });

  it.each([
    "Build and test a pressure\u200B vessel.",
    "Build and te\u200Bst a pressure vessel.",
    "Build and test a pressure\u2066 vessel.",
    "Ｂｕｉｌｄ and test a pressure vessel.",
  ])("rejects a Unicode-obscured hazardous instruction: %s", (instruction) => {
    expect(() => assertBrowserSafeActivity([instruction])).toThrow(ApiError);
    expect(
      validateTextSafety("unicode-hazard-control", [instruction]).passed,
    ).toBe(false);
  });

  it("rejects profiling, generic praise, and unsupported efficacy claims", () => {
    expect(() =>
      assertNoLearnerProfiling([
        "Your model now names oxygen supply as a tradeoff, which makes the revision specific.",
      ]),
    ).not.toThrow();
    expect(() => assertNoLearnerProfiling(["Great job!"])).toThrow(ApiError);
    expect(() =>
      assertNoLearnerProfiling([
        "Your comparison avoids treating dream content as a diagnosis.",
      ]),
    ).not.toThrow();
    expect(
      validateTextSafety("anti-diagnosis-boundary", [
        "Your comparison avoids treating dream content as a diagnosis.",
      ]).passed,
    ).toBe(true);
    expect(() =>
      assertNoLearnerProfiling(["Dream content is not a diagnosis."]),
    ).not.toThrow();
    expect(
      validateTextSafety("negated-diagnosis-boundary", [
        "Dream content is not a diagnosis.",
      ]).passed,
    ).toBe(true);
    for (const diagnosis of [
      "I diagnose you with ADHD based on this reflection.",
      "This feedback diagnoses the learner as autistic.",
      "Your dream is a diagnosis of trauma.",
      "You have a diagnosis of ADHD.",
    ]) {
      expect(() => assertNoLearnerProfiling([diagnosis])).toThrow(ApiError);
      expect(
        validateTextSafety("direct-diagnosis-control", [diagnosis]).passed,
      ).toBe(false);
    }
    expect(() =>
      assertNoLearnerProfiling([
        "Great job! Your model now mentions redundant oxygen systems.",
      ]),
    ).toThrow(ApiError);
    expect(() =>
      assertNoLearnerProfiling([
        "ReasonWeave will improve learning and achievement for every learner.",
      ]),
    ).toThrow(ApiError);
    expect(() =>
      assertNoLearnerProfiling([
        "This activity can boost curiosity for every learner.",
      ]),
    ).toThrow(ApiError);
    expect(() =>
      assertNoLearnerProfiling([
        "Your learning style is visual, so choose diagrams next.",
      ]),
    ).toThrow(ApiError);
    expect(() =>
      assertNoLearnerProfiling([
        "This activity can\nimprove your learning and retention.",
      ]),
    ).toThrow(ApiError);
    expect(() =>
      assertNoLearnerProfiling([
        "Your learning\nstyle is visual, so choose diagrams next.",
      ]),
    ).toThrow(ApiError);
    expect(() =>
      assertNoLearnerProfiling([
        "This activity can\u200B improve your learning and retention.",
      ]),
    ).toThrow(ApiError);

    expect(
      validateTextSafety("newline-outcome-control", [
        "This activity can\nimprove your learning and retention.",
      ]).passed,
    ).toBe(false);
  });

  it("includes every client-controlled route prose field in moderation", () => {
    expect(routeTextForModeration(validRoutes[0])).toEqual([
      validRoutes[0].title,
      validRoutes[0].hook,
      validRoutes[0].activityType,
    ]);
  });

  it("uses a supportive redirect for flagged self-harm content", () => {
    const categories = {
      harassment: false,
      "harassment/threatening": false,
      hate: false,
      "hate/threatening": false,
      illicit: false,
      "illicit/violent": false,
      "self-harm": true,
      "self-harm/instructions": false,
      "self-harm/intent": true,
      sexual: false,
      "sexual/minors": false,
      violence: false,
      "violence/graphic": false,
    };

    expect(moderationBlockMessage([{ flagged: true, categories }])).toContain(
      "tell a trusted adult",
    );
    expect(
      moderationBlockMessage([
        {
          flagged: true,
          categories: {
            ...categories,
            "self-harm": false,
            "self-harm/intent": false,
            harassment: true,
          },
        },
      ]),
    ).toContain("school-appropriate curiosity");
  });
});

describe("backend route validation", () => {
  it("accepts three distinct methods and rejects a duplicated lens", () => {
    expect(routesAreDiverse(validRoutes)).toBe(true);
    expect(
      routesAreDiverse([
        validRoutes[0],
        { ...validRoutes[1], lens: "understand" },
        validRoutes[2],
      ]),
    ).toBe(false);
  });
});
