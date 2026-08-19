import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  parse: vi.fn(),
}));

vi.mock("@/lib/openai/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/openai/client")>();

  return {
    ...actual,
    getOpenAIClient: () =>
      ({
        responses: { parse: provider.parse },
      }) as unknown as ReturnType<typeof actual.getOpenAIClient>,
  };
});

import { generateEvidence } from "@/lib/openai/generate-evidence";
import { generateQuest } from "@/lib/openai/generate-quest";
import { generateReflection } from "@/lib/openai/generate-reflection";
import { generateRoutes } from "@/lib/openai/generate-routes";
import type { EvidenceBundle, ExplorationRoute } from "@/types/curiosity";

const SAFETY_IDENTIFIER = "session_contract_123";

const selectedRoute: ExplorationRoute = {
  id: "pressure-detective",
  title: "Pressure Detective",
  hook: "Compare patterns to explain how pressure changes underwater.",
  lens: "understand",
  activityType: "causal comparison",
  estimatedMinutes: 10,
  iconKey: "waves",
};

const evidenceDecision = {
  evidenceItemId: "pressure-depth",
  relationship: "complicates" as const,
  establishes:
    "The cited pressure finding establishes that water pressure increases with depth.",
  unresolved:
    "It does not resolve the linked maintenance constraints in a long-lived habitat.",
  impact:
    "That boundary complicates my pressure-first prediction because maintenance still matters.",
};

const evidenceApplication = {
  evidenceItemId: "pressure-depth",
  designChoice:
    "Because pressure rises with depth, the design uses a shallower site, redundant structural monitoring, and redundant life support.",
  artifactAnchor: "redundant life support",
};

const reflectionEvidence: EvidenceBundle = {
  items: [
    {
      id: "pressure-depth",
      kind: "evidence",
      statement:
        "Water pressure increases as depth increases below the ocean surface.",
      sourceIds: ["source-1"],
    },
    {
      id: "maintenance-links",
      kind: "inference",
      statement:
        "A habitat design must compare pressure protection with maintenance access.",
      sourceIds: [],
    },
  ],
  sources: [
    {
      id: "source-1",
      title: "How does pressure change with ocean depth?",
      url: "https://oceanservice.noaa.gov/facts/pressure.html",
      domain: "oceanservice.noaa.gov",
    },
  ],
  conciseExplanation:
    "The evidence connects increasing depth with pressure while leaving several habitat tradeoffs open.",
};

const allowedModerationResult = {
  categories: {},
  category_applied_input_types: {},
  category_scores: {},
  flagged: false,
  model: "omni-moderation-latest",
  type: "moderation_result" as const,
};

function parsedResponse(outputParsed: unknown, output: unknown[] = []) {
  return {
    moderation: {
      input: allowedModerationResult,
      output: allowedModerationResult,
    },
    output,
    output_parsed: outputParsed,
    output_text: "",
  };
}

const EVIDENCE_SOURCE_URL = "https://oceanservice.noaa.gov/facts/pressure.html";

function citedEvidenceResponse({
  openQuestion,
  sourceTitle = "How does pressure change with ocean depth?",
  uncertaintyNote = null,
  omitAnnotations = false,
  actionSourceUrls = [],
  evidenceStatements = [
    "Water pressure increases as depth increases below the ocean surface.",
    "Pressure changes can be compared using equal intervals of water depth.",
  ],
}: {
  openQuestion?: string;
  sourceTitle?: string;
  uncertaintyNote?: string | null;
  omitAnnotations?: boolean;
  actionSourceUrls?: string[];
  evidenceStatements?: string[];
} = {}) {
  const items = [
    ...evidenceStatements.map((statement) => ({
      kind: "evidence",
      statement,
      citationUrls: [EVIDENCE_SOURCE_URL],
    })),
    ...(openQuestion
      ? [
          {
            kind: "open_question",
            statement: openQuestion,
            citationUrls: [],
          },
        ]
      : []),
  ];
  const outputText = JSON.stringify({ items, uncertaintyNote });
  const citationOffsets = items
    .filter((item) => item.kind === "evidence")
    .map((item) => {
      const statementStart = outputText.indexOf(
        JSON.stringify(item.statement).slice(1, -1),
      );
      if (statementStart < 0)
        throw new Error("Test statement was not serialized");
      return { start: statementStart + 1, end: statementStart + 13 };
    });

  return {
    ...parsedResponse({ items, uncertaintyNote }, [
      {
        id: "ws_contract_123",
        type: "web_search_call",
        status: "completed",
        action: {
          type: "search",
          query: "ocean pressure depth",
          sources: actionSourceUrls.map((url) => ({
            type: "url" as const,
            url,
          })),
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: outputText,
            annotations: omitAnnotations
              ? []
              : citationOffsets.map((offset) => ({
                  type: "url_citation" as const,
                  url: EVIDENCE_SOURCE_URL,
                  title: sourceTitle,
                  start_index: offset.start,
                  end_index: offset.end,
                })),
          },
        ],
      },
    ]),
    output_text: outputText,
  };
}

function expectBaseRequestContract(
  request: Record<string, unknown>,
  options: { signal?: AbortSignal },
  formatName: string,
  signal: AbortSignal,
) {
  expect(request).toEqual(
    expect.objectContaining({
      instructions: expect.stringContaining(
        "quest architect inside ReasonWeave",
      ),
      model: "gpt-5.6",
      moderation: { model: "omni-moderation-latest" },
      safety_identifier: SAFETY_IDENTIFIER,
      service_tier: "default",
      store: false,
    }),
  );
  expect(request.text).toEqual({
    verbosity: "low",
    format: expect.objectContaining({
      name: formatName,
      strict: true,
      type: "json_schema",
    }),
  });
  expect(options.signal).toBe(signal);
  expect(options.signal).toBeInstanceOf(AbortSignal);
}

describe("OpenAI Responses request contract", () => {
  beforeEach(() => {
    provider.parse.mockReset();
    vi.stubEnv("OPENAI_MODEL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("requires web search and forwards the request signal for cited evidence", async () => {
    provider.parse.mockResolvedValueOnce(citedEvidenceResponse());
    const controller = new AbortController();

    await generateEvidence(
      {
        question: "How does ocean pressure change with depth?",
        selectedRoute,
        prediction:
          "I predict that pressure rises steadily because more water sits above deeper points.",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      },
      controller.signal,
    );

    expect(provider.parse).toHaveBeenCalledOnce();
    const [request, options] = provider.parse.mock.calls[0] as [
      Record<string, unknown>,
      { signal?: AbortSignal },
    ];
    expectBaseRequestContract(
      request,
      options,
      "wonderlab_evidence",
      controller.signal,
    );
    expect(request).toEqual(
      expect.objectContaining({
        include: ["web_search_call.action.sources"],
        max_tool_calls: 3,
        max_output_tokens: 2_600,
        tool_choice: "required",
        tools: [{ type: "web_search", search_context_size: "medium" }],
      }),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "an evidence item may contain only claims the cited pages explicitly support",
      ),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "target no more than 180 words across all item statements",
      ),
    );
  });

  it("retries evidence that exceeds the rendered UI word ceiling", async () => {
    const longStatements = Array.from(
      { length: 4 },
      (_, index) =>
        `Finding ${index + 1} ${Array.from({ length: 65 }, () => "fact").join(" ")}.`,
    );
    provider.parse
      .mockResolvedValueOnce(
        citedEvidenceResponse({ evidenceStatements: longStatements }),
      )
      .mockResolvedValueOnce(citedEvidenceResponse());

    await expect(
      generateEvidence({
        question: "How does ocean pressure change with depth?",
        selectedRoute,
        prediction:
          "I predict that pressure rises steadily because more water sits above deeper points.",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).resolves.toMatchObject({ items: expect.any(Array) });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it("binds exact completed web-search action sources when URL annotations are absent", async () => {
    provider.parse.mockResolvedValueOnce(
      citedEvidenceResponse({
        omitAnnotations: true,
        actionSourceUrls: [EVIDENCE_SOURCE_URL],
      }),
    );

    const evidence = await generateEvidence({
      question: "How does ocean pressure change with depth?",
      selectedRoute,
      prediction:
        "I predict that pressure rises steadily because more water sits above deeper points.",
      level: "high_school",
      durationMinutes: 10,
      safetyIdentifier: SAFETY_IDENTIFIER,
    });

    expect(evidence.items.map((item) => item.sourceIds)).toEqual([
      ["source-1"],
      ["source-1"],
    ]);
    expect(evidence.sources).toEqual([
      {
        id: "source-1",
        title: "oceanservice.noaa.gov",
        url: EVIDENCE_SOURCE_URL,
        domain: "oceanservice.noaa.gov",
      },
    ]);
  });

  it("does not fall back to action sources when any URL annotation is present", async () => {
    const response = citedEvidenceResponse({
      actionSourceUrls: [EVIDENCE_SOURCE_URL],
    });
    const message = response.output.find(
      (output): output is { type: "message"; content: unknown[] } =>
        typeof output === "object" &&
        output !== null &&
        (output as { type?: unknown }).type === "message",
    );
    if (!message) throw new Error("Expected a Responses message");
    const outputText = message.content.find(
      (content): content is { type: "output_text"; annotations: unknown[] } =>
        typeof content === "object" &&
        content !== null &&
        (content as { type?: unknown }).type === "output_text",
    );
    if (!outputText) throw new Error("Expected Responses output text");
    outputText.annotations = outputText.annotations.slice(0, 1);
    provider.parse.mockResolvedValue(response);

    await expect(
      generateEvidence({
        question: "How does ocean pressure change with depth?",
        selectedRoute,
        prediction:
          "I predict that pressure rises steadily because more water sits above deeper points.",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).rejects.toMatchObject({ code: "CITATIONS_UNAVAILABLE" });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it("does not fall back when an extra output block carries a URL annotation", async () => {
    const response = citedEvidenceResponse({
      omitAnnotations: true,
      actionSourceUrls: [EVIDENCE_SOURCE_URL],
    });
    response.output.push({
      type: "message",
      content: [
        {
          type: "output_text",
          text: "mismatched output",
          annotations: [
            {
              type: "url_citation" as const,
              url: EVIDENCE_SOURCE_URL,
              title: "Untrusted extra block",
              start_index: 0,
              end_index: 1,
            },
          ],
        },
      ],
    });
    provider.parse.mockResolvedValue(response);

    await expect(
      generateEvidence({
        question: "How does ocean pressure change with depth?",
        selectedRoute,
        prediction:
          "I predict that pressure rises steadily because more water sits above deeper points.",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).rejects.toMatchObject({ code: "CITATIONS_UNAVAILABLE" });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it.each(["failed", "in_progress", "searching"] as const)(
    "rejects cited evidence when the web-search call status is %s",
    async (status) => {
      const incompleteSearch = citedEvidenceResponse();
      const webSearchCall = incompleteSearch.output.find(
        (output): output is { type: "web_search_call"; status: string } =>
          typeof output === "object" &&
          output !== null &&
          (output as { type?: unknown }).type === "web_search_call" &&
          typeof (output as { status?: unknown }).status === "string",
      );
      if (!webSearchCall) {
        throw new Error("Expected a web-search call in the mocked response");
      }
      webSearchCall.status = status;
      provider.parse.mockResolvedValue(incompleteSearch);

      await expect(
        generateEvidence({
          question: "How does ocean pressure change with depth?",
          selectedRoute,
          prediction:
            "I predict that pressure rises steadily because more water sits above deeper points.",
          level: "high_school",
          durationMinutes: 10,
          safetyIdentifier: SAFETY_IDENTIFIER,
        }),
      ).rejects.toMatchObject({
        code: "CITATIONS_UNAVAILABLE",
        retryable: true,
      });
      expect(provider.parse).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects a mixed completed and failed web-search response", async () => {
    const mixedSearch = citedEvidenceResponse();
    mixedSearch.output.unshift({
      id: "ws_contract_failed",
      type: "web_search_call",
      status: "failed",
    });
    provider.parse.mockResolvedValue(mixedSearch);

    await expect(
      generateEvidence({
        question: "How does ocean pressure change with depth?",
        selectedRoute,
        prediction:
          "I predict that pressure rises steadily because more water sits above deeper points.",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).rejects.toMatchObject({
      code: "CITATIONS_UNAVAILABLE",
      retryable: true,
    });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it("emits only opt-in non-production citation diagnostic metadata", async () => {
    vi.stubEnv("WONDERLAB_EVAL_DIAGNOSTICS", "1");
    const diagnostic = vi.spyOn(console, "warn").mockImplementation(() => {});
    const incompleteSearch = citedEvidenceResponse();
    const webSearchCall = incompleteSearch.output.find(
      (output): output is { type: "web_search_call"; status: string } =>
        typeof output === "object" &&
        output !== null &&
        (output as { type?: unknown }).type === "web_search_call" &&
        typeof (output as { status?: unknown }).status === "string",
    );
    if (!webSearchCall) throw new Error("Expected a web-search call");
    webSearchCall.status = "failed";
    provider.parse.mockResolvedValue(incompleteSearch);

    await expect(
      generateEvidence({
        question: "How does ocean pressure change with depth?",
        selectedRoute,
        prediction:
          "I predict that pressure rises steadily because more water sits above deeper points.",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).rejects.toMatchObject({ code: "CITATIONS_UNAVAILABLE" });

    expect(diagnostic).toHaveBeenCalledTimes(2);
    expect(diagnostic).toHaveBeenLastCalledWith(
      "reasonweave_citation_diagnostic",
      {
        webSearchCallCount: 1,
        webSearchStatuses: ["failed"],
        messageCount: 1,
        outputTextBlockCount: 1,
        outputTextMatches: true,
        totalAnnotationCount: 2,
        validUrlCitationCount: 2,
        includedWebSearchSourceCount: 0,
        structuredItemRangesResolved: true,
        normalizedSourceCount: 1,
        evidenceItemCount: 2,
        unboundEvidenceItemCount: 0,
        declaredEvidenceUrlCount: 2,
        normalizedDeclaredUrlCount: 1,
        matchedProviderSourceUrlCount: 0,
        evidenceItemsMatchedByProviderSource: 0,
      },
    );
  });

  it.each([
    [
      "multiple messages",
      (response: ReturnType<typeof citedEvidenceResponse>) => {
        response.output.push({
          type: "message",
          content: [
            {
              type: "output_text",
              text: response.output_text,
              annotations: [],
            },
          ],
        });
      },
    ],
    [
      "multiple output text blocks",
      (response: ReturnType<typeof citedEvidenceResponse>) => {
        const message = response.output.find(
          (output): output is { type: "message"; content: unknown[] } =>
            typeof output === "object" &&
            output !== null &&
            (output as { type?: unknown }).type === "message",
        );
        if (!message) throw new Error("Expected a Responses message");
        const outputTextBlock = message.content.find(
          (
            content,
          ): content is { type: "output_text"; annotations: unknown[] } =>
            typeof content === "object" &&
            content !== null &&
            (content as { type?: unknown }).type === "output_text",
        );
        if (!outputTextBlock) throw new Error("Expected Responses output text");
        message.content.push({
          type: "output_text",
          text: response.output_text,
          annotations: outputTextBlock.annotations,
        });
      },
    ],
    [
      "an output text mismatch",
      (response: ReturnType<typeof citedEvidenceResponse>) => {
        response.output_text = `${response.output_text} `;
      },
    ],
  ])(
    "fails closed when %s make citation offsets ambiguous",
    async (_scenario, mutateResponse) => {
      const response = citedEvidenceResponse();
      mutateResponse(response);
      provider.parse.mockResolvedValue(response);

      await expect(
        generateEvidence({
          question: "How does ocean pressure change with depth?",
          selectedRoute,
          prediction:
            "I predict that pressure rises steadily because more water sits above deeper points.",
          level: "high_school",
          durationMinutes: 10,
          safetyIdentifier: SAFETY_IDENTIFIER,
        }),
      ).rejects.toMatchObject({
        code: "CITATIONS_UNAVAILABLE",
        retryable: true,
      });
      expect(provider.parse).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    [
      "open question",
      {
        openQuestion:
          "Could you hold your breath underwater to compare your limits?",
      },
    ],
    [
      "uncertainty note",
      {
        uncertaintyNote:
          "Visit a cliff edge alone to collect a more precise comparison.",
      },
    ],
    [
      "returned source title",
      { sourceTitle: "Build and test a pressure vessel at home" },
    ],
  ])(
    "rejects a hazardous learner-visible evidence %s after one bounded retry",
    async (_field, options) => {
      const unsafeEvidence = citedEvidenceResponse(options);
      provider.parse
        .mockResolvedValueOnce(unsafeEvidence)
        .mockResolvedValueOnce(unsafeEvidence);

      await expect(
        generateEvidence({
          question: "How does ocean pressure change with depth?",
          selectedRoute,
          prediction:
            "I predict that pressure rises steadily because more water sits above deeper points.",
          level: "high_school",
          durationMinutes: 10,
          safetyIdentifier: SAFETY_IDENTIFIER,
        }),
      ).rejects.toMatchObject({ code: "UNSAFE_ACTIVITY", retryable: true });
      expect(provider.parse).toHaveBeenCalledTimes(2);
    },
  );

  it("sends the structured route-generation contract", async () => {
    provider.parse.mockResolvedValueOnce(
      parsedResponse({
        routes: [
          selectedRoute,
          {
            id: "habitat-designer",
            title: "Habitat Designer",
            hook: "Design a compact habitat around competing human needs.",
            lens: "create",
            activityType: "design brief",
            estimatedMinutes: 10,
            iconKey: "blueprint",
          },
          {
            id: "ecosystem-mapper",
            title: "Ecosystem Mapper",
            hook: "Map how one decision could ripple through an ocean system.",
            lens: "systems",
            activityType: "system map",
            estimatedMinutes: 10,
            iconKey: "network",
          },
        ],
      }),
    );
    const controller = new AbortController();

    await generateRoutes(
      {
        question: "How could people live and work beneath the ocean?",
        level: "college",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      },
      controller.signal,
    );

    const [request, options] = provider.parse.mock.calls[0] as [
      Record<string, unknown>,
      { signal?: AbortSignal },
    ];
    expectBaseRequestContract(
      request,
      options,
      "wonderlab_routes",
      controller.signal,
    );
    expect(request.max_output_tokens).toBe(1_800);
    expect(request.input).toEqual(
      expect.stringContaining("Create exactly three methodologically distinct"),
    );
  });

  it("redirects a submit-ready assignment request inside the server generation prompt", async () => {
    provider.parse.mockResolvedValueOnce(
      parsedResponse({
        routes: [
          selectedRoute,
          {
            id: "outline-builder",
            title: "Build Your Own Outline",
            hook: "Organize claims and evidence before choosing your position.",
            lens: "create",
            activityType: "learner-authored outline",
            estimatedMinutes: 10,
            iconKey: "blueprint",
          },
          {
            id: "claim-comparer",
            title: "Compare the Claims",
            hook: "Test competing positions against the available evidence.",
            lens: "compare",
            activityType: "evidence comparison",
            estimatedMinutes: 10,
            iconKey: "scales",
          },
        ],
      }),
    );

    await generateRoutes({
      question: "Write my five-paragraph essay about ocean habitats.",
      level: "high_school",
      durationMinutes: 10,
      safetyIdentifier: SAFETY_IDENTIFIER,
    });

    const [request] = provider.parse.mock.calls[0] as [Record<string, unknown>];
    expect(request.input).toEqual(
      expect.stringContaining("LEARNER_AGENCY_REDIRECT"),
    );
    expect(request.input).toEqual(
      expect.stringContaining("build their own outline"),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "Write my five-paragraph essay about ocean habitats.",
      ),
    );
  });

  it("sends the structured finite-quest contract", async () => {
    provider.parse.mockResolvedValueOnce(
      parsedResponse({
        drivingQuestion:
          "Which design choices best balance safety, comfort, and limited space?",
        predictionPrompt:
          "Predict which habitat feature matters most and explain the tradeoff you expect.",
        investigationPrompt:
          "Examine the route evidence for patterns that support or challenge your prediction.",
        creationChallenge:
          "Write a compact habitat proposal that explains two design choices and one tradeoff.",
        constraints: [
          "Keep the proposal entirely browser based.",
          "Use at least two pieces of route evidence.",
        ],
        completionCriteria: [
          "Names two specific design choices.",
          "Explains one evidence-based tradeoff.",
        ],
        safetyNote: "Keep this as a conceptual design activity.",
        hint: "Start by ranking the needs that cannot be compromised.",
      }),
    );
    const controller = new AbortController();

    const quest = await generateQuest(
      {
        question: "How could people live and work beneath the ocean?",
        level: "curious_adult",
        durationMinutes: 10,
        selectedRoute,
        safetyIdentifier: SAFETY_IDENTIFIER,
      },
      controller.signal,
    );

    const [request, options] = provider.parse.mock.calls[0] as [
      Record<string, unknown>,
      { signal?: AbortSignal },
    ];
    expectBaseRequestContract(
      request,
      options,
      "wonderlab_quest",
      controller.signal,
    );
    expect(request.max_output_tokens).toBe(1_800);
    expect(request.input).toEqual(
      expect.stringContaining("Build one finite quest plan"),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "Finish every prose field with a complete sentence",
      ),
    );
    expect(request.input).toEqual(
      expect.stringContaining("investigation prompts at most 280 each"),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "Use 2–3 constraints and 1–2 completion criteria",
      ),
    );
    expect(request.input).not.toEqual(
      expect.stringContaining(
        "two to four concrete constraints and two to four observable completion criteria",
      ),
    );
    const questFormat = (
      request.text as {
        format: {
          schema: {
            properties: {
              constraints: { minItems: number; maxItems: number };
              completionCriteria: { minItems: number; maxItems: number };
            };
          };
        };
      }
    ).format;
    expect(questFormat.schema.properties.constraints).toMatchObject({
      minItems: 2,
      maxItems: 3,
    });
    expect(questFormat.schema.properties.completionCriteria).toMatchObject({
      minItems: 1,
      maxItems: 2,
    });
    expect(quest.timeBudget).toEqual({
      totalMinutes: 10,
      steps: {
        choose: 1,
        predict: 1,
        investigate: 2,
        create: 3,
        reflect: 2,
        branch: 1,
      },
    });
  });

  it("retries a quest whose investigation prompt saturates its model limit", async () => {
    const completeQuest = {
      drivingQuestion:
        "Which design choices best balance safety, comfort, and limited space?",
      predictionPrompt:
        "Predict which habitat feature matters most and explain the tradeoff you expect.",
      investigationPrompt:
        "Examine the route evidence for patterns that support or challenge your prediction.",
      creationChallenge:
        "Write a compact habitat proposal that explains two design choices and one tradeoff.",
      constraints: [
        "Keep the proposal entirely browser based.",
        "Use at least two pieces of route evidence.",
      ],
      completionCriteria: [
        "Names two specific design choices.",
        "Explains one evidence-based tradeoff.",
      ],
      safetyNote: "Keep this as a conceptual design activity.",
      hint: "Start by ranking the needs that cannot be compromised.",
    };
    provider.parse
      .mockResolvedValueOnce(
        parsedResponse({
          ...completeQuest,
          investigationPrompt: `${"A".repeat(319)}.`,
        }),
      )
      .mockResolvedValueOnce(parsedResponse(completeQuest));

    await expect(
      generateQuest({
        question: "How could people live and work beneath the ocean?",
        level: "curious_adult",
        durationMinutes: 10,
        selectedRoute,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).resolves.toMatchObject({
      investigationPrompt: completeQuest.investigationPrompt,
    });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it("makes the five-minute structured quest workload exact", async () => {
    provider.parse.mockResolvedValueOnce(
      parsedResponse({
        drivingQuestion:
          "Which design choice matters most for a compact underwater habitat?",
        predictionPrompt:
          "Predict which habitat feature matters most and explain your first choice.",
        investigationPrompt:
          "Compare that prediction with the selected route evidence and its limits.",
        creationChallenge:
          "Write one compact browser-only habitat choice and explain its main tradeoff.",
        constraints: [
          "Keep the proposal entirely browser based.",
          "Use one relevant piece of route evidence.",
        ],
        completionCriteria: ["Explain one evidence-based design tradeoff."],
        safetyNote: "Keep this as a conceptual design activity.",
        hint: "Start with the one need that cannot be compromised.",
      }),
    );
    const controller = new AbortController();

    const quest = await generateQuest(
      {
        question: "How could people live and work beneath the ocean?",
        level: "high_school",
        durationMinutes: 5,
        selectedRoute,
        safetyIdentifier: SAFETY_IDENTIFIER,
      },
      controller.signal,
    );

    const [request, options] = provider.parse.mock.calls[0] as [
      Record<string, unknown>,
      { signal?: AbortSignal },
    ];
    expectBaseRequestContract(
      request,
      options,
      "wonderlab_quest",
      controller.signal,
    );
    const questFormat = (
      request.text as {
        format: {
          schema: {
            properties: {
              constraints: { minItems: number; maxItems: number };
              completionCriteria: { minItems: number; maxItems: number };
            };
          };
        };
      }
    ).format;
    expect(questFormat.schema.properties.constraints).toMatchObject({
      minItems: 2,
      maxItems: 2,
    });
    expect(questFormat.schema.properties.completionCriteria).toMatchObject({
      minItems: 1,
      maxItems: 1,
    });
    expect(quest.timeBudget).toEqual({
      totalMinutes: 5,
      steps: {
        choose: 0.5,
        predict: 0.5,
        investigate: 1,
        create: 1.5,
        reflect: 1,
        branch: 0.5,
      },
    });
  });

  it("sends the structured learner-agency reflection contract", async () => {
    provider.parse.mockResolvedValueOnce(
      parsedResponse({
        specificFeedback:
          "Your evidence decision says water pressure increases with depth, which complicates the pressure-first model and exposes maintenance constraints it did not resolve.",
        discoverySummary:
          "The investigation connected increasing water pressure with habitat structure and human constraints.",
        changedThinking:
          "Your reflection shifts from one preferred feature toward balancing several linked constraints.",
        keyTradeoff:
          "More structural protection can reduce usable habitat space.",
        newQuestions: [
          "How would evacuation priorities change the habitat layout?",
          "Which habitat systems should have independent backups?",
          "How might the design affect nearby marine ecosystems?",
        ],
      }),
    );
    const controller = new AbortController();

    await generateReflection(
      {
        question: "How could people live and work beneath the ocean?",
        route: selectedRoute,
        prediction:
          "I predicted that pressure resistance would dominate every other design choice.",
        evidence: reflectionEvidence,
        evidenceDecision,
        evidenceApplication,
        artifact:
          "My habitat uses a compact reinforced shell, redundant life support, and modular living spaces.",
        reflection: {
          usedToThink:
            "One engineering constraint would decide the whole design.",
          nowThink: "Several connected constraints shape a workable design.",
          stillWonder: "How emergency planning would change the layout.",
        },
        safetyIdentifier: SAFETY_IDENTIFIER,
      },
      controller.signal,
    );

    const [request, options] = provider.parse.mock.calls[0] as [
      Record<string, unknown>,
      { signal?: AbortSignal },
    ];
    expectBaseRequestContract(
      request,
      options,
      "wonderlab_reflection",
      controller.signal,
    );
    expect(request.max_output_tokens).toBe(2_000);
    expect(request.input).toEqual(
      expect.stringContaining("create the final branch"),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "Finish specificFeedback, discoverySummary, changedThinking, and keyTradeoff when present with complete sentences",
      ),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "In both specificFeedback and changedThinking, naturally reuse at least two concrete terms",
      ),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "Every newQuestions item must end with a question mark",
      ),
    );
    expect(request.input).toEqual(
      expect.stringContaining("specificFeedback at most 600 characters"),
    );
    expect(request.input).not.toEqual(
      expect.stringContaining(evidenceDecision.evidenceItemId),
    );
    expect(request.input).toEqual(
      expect.stringContaining(evidenceDecision.relationship),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "Explicitly attribute the recorded “complicates” choice to the learner",
      ),
    );
    expect(request.input).toEqual(
      expect.stringContaining(
        "If they expose a mismatch, preserve the recorded choice",
      ),
    );
    expect(request.input).not.toEqual(
      expect.stringContaining("Do not negate, reverse, or contradict"),
    );
    expect(request.input).toEqual(
      expect.stringContaining(evidenceDecision.establishes),
    );
    expect(request.input).toEqual(
      expect.stringContaining(evidenceDecision.unresolved),
    );
    expect(request.input).toEqual(
      expect.stringContaining(evidenceDecision.impact),
    );
    expect(request.input).toEqual(
      expect.stringContaining(evidenceApplication.designChoice),
    );
    expect(request.input).toEqual(
      expect.stringContaining(reflectionEvidence.items[0].statement),
    );
    expect(request.input).toEqual(
      expect.stringContaining(reflectionEvidence.sources[0].title),
    );
    const learnerDataSection = String(request.input).split("LEARNER_DATA\n")[1];
    expect(learnerDataSection).not.toContain(
      "Respond specifically to all three parts",
    );
    expect(learnerDataSection).not.toContain(
      "Explicitly attribute the recorded",
    );
  });

  it.each([
    ["feedback", "specificFeedback", 700],
    ["key tradeoff", "keyTradeoff", 300],
  ] as const)(
    "retries a reflection whose %s saturates its model limit",
    async (_label, field, limit) => {
      const completeReflection = {
        specificFeedback:
          "Your evidence decision says water pressure increases with depth, which complicates the pressure-first model and exposes maintenance constraints it did not resolve.",
        discoverySummary:
          "The investigation connected increasing water pressure with habitat structure and human constraints.",
        changedThinking:
          "Your reflection shifts from one preferred feature toward balancing several linked constraints.",
        keyTradeoff:
          "More structural protection can reduce usable habitat space.",
        newQuestions: [
          "How would evacuation priorities change the habitat layout?",
          "Which habitat systems should have independent backups?",
          "How might the design affect nearby marine ecosystems?",
        ],
      };
      provider.parse
        .mockResolvedValueOnce(
          parsedResponse({
            ...completeReflection,
            [field]: `${"A".repeat(limit - 1)}.`,
          }),
        )
        .mockResolvedValueOnce(parsedResponse(completeReflection));

      await expect(
        generateReflection({
          question: "How could people live and work beneath the ocean?",
          route: selectedRoute,
          prediction:
            "I predicted that pressure resistance would dominate every other design choice.",
          evidence: reflectionEvidence,
          evidenceDecision,
          evidenceApplication,
          artifact:
            "My habitat uses a compact reinforced shell, redundant life support, and modular living spaces.",
          reflection: {
            usedToThink:
              "One engineering constraint would decide the whole design.",
            nowThink: "Several connected constraints shape a workable design.",
            stillWonder: "How emergency planning would change the layout.",
          },
          safetyIdentifier: SAFETY_IDENTIFIER,
        }),
      ).resolves.toMatchObject({
        specificFeedback: completeReflection.specificFeedback,
      });
      expect(provider.parse).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects unsafe route directions after one bounded output retry", async () => {
    const unsafeRoutes = parsedResponse({
      routes: [
        selectedRoute,
        {
          id: "cliff-edge-survey",
          title: "Cliff Edge Survey",
          hook: "Visit a cliff edge alone and measure how the landscape changes below.",
          lens: "create",
          activityType: "field survey",
          estimatedMinutes: 10,
          iconKey: "compass",
        },
        {
          id: "system-mapper",
          title: "System Mapper",
          hook: "Map connected causes using a browser-based systems diagram.",
          lens: "systems",
          activityType: "systems map",
          estimatedMinutes: 10,
          iconKey: "network",
        },
      ],
    });
    provider.parse
      .mockResolvedValueOnce(unsafeRoutes)
      .mockResolvedValueOnce(unsafeRoutes);

    await expect(
      generateRoutes({
        question: "How do landscapes change over time?",
        level: "high_school",
        durationMinutes: 10,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_ACTIVITY", retryable: true });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it("retries an unsafe quest once and accepts the corrected browser-only plan", async () => {
    const safeQuest = {
      drivingQuestion:
        "Which design choices best balance safety, comfort, and limited space?",
      predictionPrompt:
        "Predict which habitat feature matters most and explain the tradeoff you expect.",
      investigationPrompt:
        "Examine the route evidence for patterns that support or challenge your prediction.",
      creationChallenge:
        "Write a browser-only habitat proposal with two design choices and one tradeoff.",
      constraints: [
        "Keep the proposal entirely browser based.",
        "Use at least two pieces of route evidence.",
      ],
      completionCriteria: [
        "Names two specific design choices.",
        "Explains one evidence-based tradeoff.",
      ],
      safetyNote: "Keep this as a conceptual design activity.",
      hint: "Start by ranking the needs that cannot be compromised.",
    };
    provider.parse
      .mockResolvedValueOnce(
        parsedResponse({
          ...safeQuest,
          creationChallenge:
            "Boil water on a stove and compare how quickly two containers heat up.",
        }),
      )
      .mockResolvedValueOnce(parsedResponse(safeQuest));

    await expect(
      generateQuest({
        question: "How could people live and work beneath the ocean?",
        level: "high_school",
        durationMinutes: 10,
        selectedRoute,
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).resolves.toMatchObject({
      routeId: selectedRoute.id,
      creationChallenge: safeQuest.creationChallenge,
    });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it("retries generic reflection output and accepts learner-grounded question-form output", async () => {
    const reflectionRequest = {
      question: "How could people live and work beneath the ocean?",
      route: selectedRoute,
      prediction:
        "I predicted that pressure resistance would dominate every design choice.",
      evidence: reflectionEvidence,
      evidenceDecision,
      evidenceApplication,
      artifact:
        "My habitat uses a reinforced shell, redundant life support, and modular living spaces.",
      reflection: {
        usedToThink: "One constraint would decide the entire design.",
        nowThink: "Several connected constraints shape a workable habitat.",
        stillWonder: "How emergency planning would change the layout.",
      },
      safetyIdentifier: SAFETY_IDENTIFIER,
    } as const;
    const grounded = {
      specificFeedback:
        "Your evidence decision complicates a pressure-only model: water pressure increases with depth, while maintenance constraints and emergency planning remain connected.",
      discoverySummary:
        "The investigation connected pressure, redundancy, and emergency access as one habitat system.",
      changedThinking:
        "Your reflection shifts from one dominant constraint toward several connected habitat needs.",
      keyTradeoff:
        "More redundancy improves resilience but increases space and maintenance demands.",
      newQuestions: [
        "Which habitat systems need physically separate backups?",
        "How would emergency access change the module layout?",
        "What evidence would set an acceptable maintenance interval?",
      ],
    };
    provider.parse
      .mockResolvedValueOnce(
        parsedResponse({
          ...grounded,
          specificFeedback:
            "Your design shows careful thought about the topic and presents a detailed response.",
          changedThinking:
            "Your design shifted from an early idea toward a more complete view.",
          newQuestions: [
            "Which evidence would challenge the current design?",
            "What tradeoff deserves another comparison?",
            "How could the learner test the strongest assumption?",
          ],
        }),
      )
      .mockResolvedValueOnce(parsedResponse(grounded));

    await expect(generateReflection(reflectionRequest)).resolves.toMatchObject({
      specificFeedback: grounded.specificFeedback,
      newQuestions: grounded.newQuestions,
    });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });

  it("rejects a dangerous next-question branch after one bounded retry", async () => {
    const unsafeReflection = parsedResponse({
      specificFeedback:
        "Your habitat reflection connects pressure evidence with emergency access and redundant life support.",
      discoverySummary:
        "The investigation connected pressure, redundancy, and emergency access as one habitat system.",
      changedThinking:
        "Your reflection shifts from pressure alone toward several connected habitat constraints.",
      keyTradeoff:
        "More redundancy improves resilience but increases maintenance demands.",
      newQuestions: [
        "Could you hold your breath underwater to compare your limits?",
        "Which habitat systems need physically separate backups?",
        "How would emergency access change the module layout?",
      ],
    });
    provider.parse
      .mockResolvedValueOnce(unsafeReflection)
      .mockResolvedValueOnce(unsafeReflection);

    await expect(
      generateReflection({
        question: "How could people live and work beneath the ocean?",
        route: selectedRoute,
        prediction:
          "I predicted that pressure resistance would dominate every design choice.",
        evidence: reflectionEvidence,
        evidenceDecision,
        evidenceApplication,
        artifact:
          "My habitat uses a reinforced shell, redundant life support, and modular living spaces.",
        reflection: {
          usedToThink: "One constraint would decide the entire design.",
          nowThink: "Several connected constraints shape a workable habitat.",
          stillWonder: "How emergency planning would change the layout.",
        },
        safetyIdentifier: SAFETY_IDENTIFIER,
      }),
    ).rejects.toMatchObject({ code: "UNSAFE_ACTIVITY", retryable: true });
    expect(provider.parse).toHaveBeenCalledTimes(2);
  });
});
