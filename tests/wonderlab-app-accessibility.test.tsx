import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReasonWeaveApp } from "@/components/wonderlab-app";
import seededDemoJson from "@/data/demo-underwater.json";
import {
  createCuriositySession,
  transitionSession,
} from "@/lib/session-machine";
import { questTimeBudgetFor } from "@/lib/quest-time-budget";
import { seededDemoSessionSchema } from "@/lib/schemas";
const scrollIntoView = vi.fn();
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

async function renderCreateStep() {
  const session = buildLiveSession("create", 15);
  storage.set(
    "wonderlab.session.v4",
    JSON.stringify({ version: 1, savedAt: Date.now(), data: session }),
  );
  render(<ReasonWeaveApp />);
  await screen.findByRole("button", { name: /finish creation/i });
}

function buildLiveSession(
  step: "predict" | "create" | "reflect" | "branch",
  durationMinutes = seededDemoSessionSchema.parse(seededDemoJson)
    .durationMinutes,
) {
  const seededSession = seededDemoSessionSchema.parse(seededDemoJson);
  const seededQuest = seededSession.quest;
  const quest = seededQuest
    ? {
        ...seededQuest,
        timeBudget: questTimeBudgetFor(durationMinutes),
        constraints: seededQuest.constraints.slice(
          0,
          durationMinutes === 5 ? 2 : durationMinutes === 10 ? 3 : 4,
        ),
        completionCriteria: seededQuest.completionCriteria.slice(
          0,
          durationMinutes === 5 ? 1 : durationMinutes === 10 ? 2 : 4,
        ),
      }
    : undefined;
  const route = seededSession.routes.find(
    (candidate) => candidate.id === quest?.routeId,
  );
  if (!route || !quest) throw new Error("Expected a seeded quest route.");

  let session = createCuriositySession(
    {
      question: seededSession.question,
      level: seededSession.level,
      durationMinutes,
      mode: "live",
    },
    { id: `restored-live-${step}`, now: "2026-07-18T12:00:00.000Z" },
  );
  session = transitionSession(session, {
    type: "ROUTES_GENERATED",
    routes: seededSession.routes,
    at: "2026-07-18T12:01:00.000Z",
  });
  session = transitionSession(session, {
    type: "ROUTE_SELECTED",
    routeId: route.id,
    at: "2026-07-18T12:02:00.000Z",
  });
  session = transitionSession(session, {
    type: "QUEST_LOADED",
    quest,
    at: "2026-07-18T12:03:00.000Z",
  });
  if (step === "predict") return session;

  session = transitionSession(session, {
    type: "PREDICTION_SUBMITTED",
    prediction: seededSession.prediction!,
    at: "2026-07-18T12:04:00.000Z",
  });
  session = transitionSession(session, {
    type: "EVIDENCE_LOADED",
    evidence: seededSession.evidence!,
    at: "2026-07-18T12:05:00.000Z",
  });
  if (step === "create") return session;
  session = transitionSession(session, {
    type: "ARTIFACT_SUBMITTED",
    artifact: seededSession.artifact!,
    evidenceDecision: seededSession.evidenceDecision!,
    evidenceApplication: seededSession.evidenceApplication!,
    at: "2026-07-18T12:06:00.000Z",
  });
  if (step === "reflect") return session;
  return transitionSession(session, {
    type: "REFLECTION_COMPLETED",
    reflectionInput: seededSession.reflectionInput!,
    reflectionResult: seededSession.reflectionResult!,
    at: "2026-07-18T12:07:00.000Z",
  });
}

beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("learner input and interaction accessibility", () => {
  it("renders the initial learner control with stable completion-safe semantics and a focusable skip target", () => {
    render(<ReasonWeaveApp />);

    const question = screen.getByLabelText(/what are you curious about/i);
    expect(question).toHaveAttribute("name", "question");
    expect(question).toHaveAttribute("autocomplete", "off");

    const skipLink = screen.getByRole("link", { name: /skip to quest/i });
    const main = screen.getByRole("main");
    expect(skipLink).toHaveAttribute("href", "#main-content");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
    main.focus();
    expect(main).toHaveFocus();
  });

  it("makes the complete demo the only Spark action when live generation is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ReasonWeaveApp liveGenerationAvailable={false} />);

    expect(
      screen.getByText(/live exploration is unavailable in this release/i),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /generate 3 routes/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/what are you curious about/i)).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /try complete demo/i }));

    expect(
      await screen.findByRole("heading", {
        name: "Three ways into your question.",
      }),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears an unfinished restored live session when live generation is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const unfinishedLiveSession = buildLiveSession("predict");
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: unfinishedLiveSession,
      }),
    );

    render(<ReasonWeaveApp liveGenerationAvailable={false} />);

    expect(
      await screen.findByText(
        /live exploration is unavailable in this release/i,
      ),
    ).toBeVisible();
    expect(storage.has("wonderlab.session.v4")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /try complete demo/i }));

    expect(
      await screen.findByRole("heading", {
        name: "Three ways into your question.",
      }),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a provider-free restored live Branch trace when live generation is unavailable", async () => {
    const completedLiveSession = buildLiveSession("branch");
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: completedLiveSession,
      }),
    );

    render(<ReasonWeaveApp liveGenerationAvailable={false} />);

    expect(
      await screen.findByText(
        /choose one branch to complete your portable learning trace/i,
      ),
    ).toBeVisible();
    expect(storage.has("wonderlab.session.v4")).toBe(true);
  });

  it("returns a restored pre-anchor Reflect session to Create and preserves its learner work", async () => {
    const legacyReflect = buildLiveSession("reflect");
    delete legacyReflect.evidenceApplication!.artifactAnchor;
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: legacyReflect,
      }),
    );

    render(<ReasonWeaveApp />);

    const designChoice = await screen.findByLabelText(
      /finding → design choice/i,
    );
    const creation = screen.getByLabelText(
      /build your response in the browser/i,
    );
    expect(designChoice).toHaveValue(
      legacyReflect.evidenceApplication!.designChoice,
    );
    expect(creation).toHaveValue(legacyReflect.artifact);

    fireEvent.change(screen.getByLabelText(/creation anchor phrase/i), {
      target: { value: "regular deliveries" },
    });
    fireEvent.click(
      screen.getByLabelText(
        /I reviewed my response against every completion criterion/i,
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /finish creation/i }));

    expect(
      await screen.findByRole("heading", {
        name: /make the change in your thinking visible/i,
      }),
    ).toBeVisible();
  });

  it("renders a disabled unavailable state without a demo or live submission path", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ReasonWeaveApp
        allowSeededFallback={false}
        liveGenerationAvailable={false}
      />,
    );

    expect(
      screen.getByText(/exploration is unavailable in this release/i),
    ).toBeVisible();
    expect(
      screen.getByText(
        /live generation and the pre-generated demo are not enabled/i,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /generate 3 routes/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /try complete demo/i }),
    ).not.toBeInTheDocument();

    const question = screen.getByLabelText(/what are you curious about/i);
    const form = question.closest("form");
    expect(question).toBeDisabled();
    expect(form).not.toBeNull();
    form?.querySelectorAll("button").forEach((button) => {
      expect(button).toBeDisabled();
    });

    fireEvent.submit(form!);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps custom live generation primary when the server marks it available", () => {
    render(<ReasonWeaveApp liveGenerationAvailable />);

    expect(
      screen.getByRole("button", { name: /generate 3 routes/i }),
    ).toHaveClass("button-primary");
    expect(
      screen.getByRole("button", { name: /try complete demo/i }),
    ).toHaveClass("button-secondary");
    expect(screen.getByLabelText(/what are you curious about/i)).toBeEnabled();
  });

  it("renders creation controls with stable names and browser completion disabled", async () => {
    await renderCreateStep();

    for (const [label, name] of [
      [/choose one source-backed finding/i, "evidence-decision-item"],
      [/what do the cited sources establish/i, "evidence-decision-establishes"],
      [/where does this source scope stop/i, "evidence-decision-unresolved"],
      [/why does that matter/i, "evidence-decision-impact"],
      [/finding → design choice/i, "evidence-application-choice"],
      [/creation anchor phrase/i, "artifact-anchor"],
      [/build your response/i, "creation-response"],
    ]) {
      const control = await screen.findByLabelText(label);
      expect(control).toHaveAttribute("name", name);
      expect(control).toHaveAttribute("autocomplete", "off");
    }

    const evidenceChoice = screen.getByLabelText(
      /choose one source-backed finding/i,
    );
    const selectedOption = Array.from(
      (evidenceChoice as HTMLSelectElement).options,
    ).find((option) => option.value);
    expect(selectedOption).toBeDefined();
    fireEvent.change(evidenceChoice, {
      target: { value: selectedOption!.value },
    });
    const selectedSources = await screen.findByRole("list", {
      name: "Sources linked to the selected finding",
    });
    const sourceLink = within(selectedSources).getByRole("link");
    expect(sourceLink).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:/),
    );
    expect(
      screen.getByText(
        "Separate what this source directly supports from your inference or a question it cannot answer.",
      ),
    ).toBeVisible();
  });

  it("turns the five-minute evidence decision into one compact three-line note without changing learner ownership", async () => {
    const quickSession = buildLiveSession("create", 5);
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: quickSession,
      }),
    );

    render(<ReasonWeaveApp />);

    const quickNote = await screen.findByRole("textbox", {
      name: /quick source note/i,
    });
    expect(quickNote).toHaveAttribute("name", "compact-evidence-note");
    expect(quickNote).toHaveAttribute("autocomplete", "off");
    expect(screen.getByText(/5-minute quick trace/i)).toBeVisible();
    expect(
      screen.getByText(
        /5-minute learner-work plan: choose 30 seconds, predict 30 seconds, investigate 1 minute, create 1 minute and 30 seconds, reflect 1 minute, branch 30 seconds/i,
      ),
    ).toHaveClass("sr-only");
    expect(
      screen.getByText(
        /Plan: choose 30s · predict 30s · investigate 1m · create 1m 30s · reflect 1m · branch 30s/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("list", { name: "Quick source note line order" }),
    ).toHaveTextContent(
      /what the cited sources show.*where their source scope stops.*why that matters for your prediction/i,
    );
    expect(
      screen.queryByLabelText("What do the cited sources establish?"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Where does this source scope stop?"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Why does that matter for your prediction?"),
    ).not.toBeInTheDocument();

    const evidenceChoice = screen.getByLabelText(
      /choose one source-backed finding/i,
    ) as HTMLSelectElement;
    const firstFinding = Array.from(evidenceChoice.options).find(
      (option) => option.value,
    );
    fireEvent.change(evidenceChoice, {
      target: { value: firstFinding!.value },
    });
    fireEvent.click(
      screen.getByRole("radio", { name: "Complicates my prediction" }),
    );
    fireEvent.change(quickNote, {
      target: {
        value:
          "These sources show one tested underwater habitat constraint.\nThis evidence does not settle whether a hundred people could live independently.",
      },
    });
    fireEvent.submit(quickNote.closest("form")!);
    expect(quickNote).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /write exactly three short lines/i,
    );

    fireEvent.change(quickNote, {
      target: {
        value:
          "These sources show one tested underwater habitat constraint.\nThis evidence does not settle whether a hundred people could live independently.\nThat boundary complicates my prediction by adding surface dependence.",
      },
    });
    fireEvent.change(screen.getByLabelText(/finding → design choice/i), {
      target: {
        value:
          "Because surface dependence matters, I added a detachable service module.",
      },
    });
    fireEvent.change(screen.getByLabelText(/creation anchor phrase/i), {
      target: { value: "detachable service module" },
    });
    fireEvent.change(
      screen.getByLabelText(/build your response in the browser/i),
      {
        target: {
          value:
            "My compact design keeps a detachable service module and redundant life support.",
        },
      },
    );
    fireEvent.click(
      screen.getByLabelText(
        /reviewed my response against every completion criterion/i,
      ),
    );
    fireEvent.submit(quickNote.closest("form")!);

    expect(
      await screen.findByRole("heading", {
        name: "Make the change in your thinking visible.",
      }),
    ).toBeVisible();
  });

  it("uses the compact evidence decision for a focused ten-minute trace", async () => {
    const focusedSession = buildLiveSession("create", 10);
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: focusedSession,
      }),
    );

    render(<ReasonWeaveApp />);

    expect(
      await screen.findByRole("textbox", { name: "Source note" }),
    ).toBeVisible();
    expect(screen.getByText("10-minute focused trace.")).toBeVisible();
    expect(
      screen.getByText(
        /10-minute learner-work plan: choose 1 minute, predict 1 minute, investigate 2 minutes, create 3 minutes, reflect 2 minutes, branch 1 minute/i,
      ),
    ).toHaveClass("sr-only");
    expect(
      screen.queryByLabelText("What do the cited sources establish?"),
    ).not.toBeInTheDocument();
  });

  it("shows only every source linked to the selected finding, in source order", async () => {
    const seededSession = seededDemoSessionSchema.parse(seededDemoJson);
    const evidence = structuredClone(seededSession.evidence!);
    const selectedFinding = evidence.items.find(
      (item) => item.kind === "evidence",
    )!;
    const secondSource = {
      id: "whoi-pressure",
      title: "Pressure in the Deep Sea",
      url: "https://www.whoi.edu/know-your-ocean/ocean-topics/how-the-ocean-works/ocean-zones/deep-ocean/",
      domain: "whoi.edu",
    };
    evidence.sources.push(secondSource);
    selectedFinding.sourceIds = [
      selectedFinding.sourceIds[0]!,
      secondSource.id,
    ];

    let session = buildLiveSession("predict");
    session = transitionSession(session, {
      type: "PREDICTION_SUBMITTED",
      prediction: seededSession.prediction!,
      at: "2026-07-18T12:04:00.000Z",
    });
    session = transitionSession(session, {
      type: "EVIDENCE_LOADED",
      evidence,
      at: "2026-07-18T12:05:00.000Z",
    });
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: session }),
    );

    render(<ReasonWeaveApp liveGenerationAvailable />);
    const evidenceChoice = await screen.findByLabelText(
      /choose one source-backed finding/i,
    );
    fireEvent.change(evidenceChoice, {
      target: { value: selectedFinding.id },
    });

    const sourceById = new Map(
      evidence.sources.map((source) => [source.id, source]),
    );
    const expectedSources = selectedFinding.sourceIds.map((sourceId) =>
      sourceById.get(sourceId)!,
    );
    const selectedSources = await screen.findByRole("list", {
      name: "Sources linked to the selected finding",
    });
    const links = within(selectedSources).getAllByRole("link");
    expect(links).toHaveLength(expectedSources.length);
    expectedSources.forEach((source, index) => {
      expect(links[index]).toHaveAttribute("href", source.url);
      expect(links[index]).toHaveTextContent(source.title);
      expect(links[index]).toHaveTextContent(source.domain);
    });

    const optionValues = Array.from(
      (evidenceChoice as HTMLSelectElement).options,
    )
      .map((option) => option.value)
      .filter(Boolean);
    expect(optionValues).toEqual(
      evidence.items
        .filter((item) => item.kind === "evidence")
        .map((item) => item.id),
    );
  });

  it.each([
    ["auto", true],
    ["smooth", false],
  ] as const)(
    "uses %s scroll behavior for creation validation when reduced motion is %s",
    async (behavior, reducedMotion) => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({ matches: reducedMotion })),
      );
      await renderCreateStep();

      fireEvent.click(
        await screen.findByRole("button", { name: /finish creation/i }),
      );

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior,
        block: "center",
      });
    },
  );

  it("focuses a newly unlocked Discovery Card on mobile", async () => {
    const pendingBranchSession: Record<string, unknown> =
      structuredClone(seededDemoJson);
    delete pendingBranchSession.selectedNextQuestionId;
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: pendingBranchSession,
      }),
    );
    vi.stubGlobal("innerWidth", 390);

    render(<ReasonWeaveApp />);
    fireEvent.click(
      await screen.findByRole("radio", {
        name: /ecosystem signals should force the habitat/i,
      }),
    );

    expect(
      screen.getByRole("region", { name: "Discovery Card" }),
    ).toHaveFocus();
  });

  it("does not reveal the Discovery Card on desktop or for a restored choice", async () => {
    vi.stubGlobal("innerWidth", 1280);
    const pendingBranchSession: Record<string, unknown> =
      structuredClone(seededDemoJson);
    delete pendingBranchSession.selectedNextQuestionId;
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: pendingBranchSession,
      }),
    );

    render(<ReasonWeaveApp />);
    const nextQuestion = await screen.findByRole("radio", {
      name: /ecosystem signals should force the habitat/i,
    });
    nextQuestion.focus();
    fireEvent.click(nextQuestion);
    expect(nextQuestion).toHaveFocus();

    vi.stubGlobal("innerWidth", 390);
    const secondQuestion = screen.getByRole("radio", {
      name: /how much food could 100 residents grow/i,
    });
    secondQuestion.focus();
    fireEvent.click(secondQuestion);
    expect(secondQuestion).toHaveFocus();

    cleanup();
    storage.set(
      "wonderlab.session.v4",
      JSON.stringify({ version: 1, savedAt: Date.now(), data: seededDemoJson }),
    );
    render(<ReasonWeaveApp />);

    await screen.findByRole("article", { name: "Discovery Card" });
    expect(
      screen.getByRole("region", { name: "Discovery Card" }),
    ).not.toHaveFocus();
  });
});
