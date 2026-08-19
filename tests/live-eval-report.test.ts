import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import { CANONICAL_EVAL_FIXTURE } from "@/evals/fixtures";
import {
  buildEvidenceSourceAssociations,
  buildLiveEvaluationReport,
  createLiveEvalStageTimings,
  liveEvaluationReportPath,
  safeEvaluationTargetOrigin,
  sanitizeLiveEvalError,
  summarizeCuriosityMap,
  type LiveEvalFixtureReport,
} from "@/evals/live-report";
import { buildFinalCuriosityMap } from "@/lib/map";
import { seededDemoSessionSchema } from "@/lib/schemas";

const seededDemo = seededDemoSessionSchema.parse(seededDemoJson);

function completeFixtureReport(): LiveEvalFixtureReport {
  const selectedRoute = seededDemo.routes.find(
    (route) => route.id === seededDemo.selectedRouteId,
  );
  if (
    !selectedRoute ||
    !seededDemo.quest ||
    !seededDemo.evidence ||
    !seededDemo.reflectionResult
  ) {
    throw new Error("The seeded evaluation fixture must be complete.");
  }

  const stageTimings = createLiveEvalStageTimings();
  for (const stage of Object.keys(stageTimings) as Array<
    keyof typeof stageTimings
  >) {
    stageTimings[stage] = { status: "completed", durationMs: 25 };
  }

  return {
    id: CANONICAL_EVAL_FIXTURE.id,
    question: CANONICAL_EVAL_FIXTURE.question,
    settings: {
      level: CANONICAL_EVAL_FIXTURE.level,
      durationMinutes: CANONICAL_EVAL_FIXTURE.durationMinutes,
    },
    syntheticInput: {
      prediction: CANONICAL_EVAL_FIXTURE.prediction,
      evidenceDecision: seededDemo.evidenceDecision ?? null,
      evidenceApplication: seededDemo.evidenceApplication ?? null,
      artifact: CANONICAL_EVAL_FIXTURE.artifact,
      reflection: { ...CANONICAL_EVAL_FIXTURE.reflection },
    },
    startedAt: "2026-07-16T20:00:00.000Z",
    completedAt: "2026-07-16T20:00:01.000Z",
    durationMs: 1_000,
    stageTimings,
    routes: [...seededDemo.routes],
    selectedRoute,
    quest: seededDemo.quest,
    evidence: {
      bundle: seededDemo.evidence,
      sourceAssociations: buildEvidenceSourceAssociations(seededDemo.evidence),
    },
    reflectionResult: seededDemo.reflectionResult,
    mapSummary: summarizeCuriosityMap(buildFinalCuriosityMap(seededDemo)),
    checks: [
      { id: "routes:routes-exactly-three", passed: true, detail: "ok" },
      { id: "map:map-node-count", passed: true, detail: "ok" },
    ],
    failure: null,
    passed: true,
  };
}

describe("live evaluation report", () => {
  it("records reviewable evidence associations and a finite map summary", () => {
    const report = completeFixtureReport();
    const associations = report.evidence?.sourceAssociations ?? [];

    expect(associations).toHaveLength(seededDemo.evidence?.items.length ?? 0);
    expect(
      associations
        .flatMap((association) => association.sources)
        .map((source) => source.url),
    ).toContain("https://oceanservice.noaa.gov/facts/pressure.html");
    expect(
      associations.every(
        (association) => association.unresolvedSourceIds.length === 0,
      ),
    ).toBe(true);
    expect(report.mapSummary).toMatchObject({
      nodeCount: 9,
      edgeCount: 8,
      nodeKinds: { next_question: 3 },
    });
  });

  it("summarizes passes and preserves partial stage failure evidence", () => {
    const passedFixture = completeFixtureReport();
    const failedFixture: LiveEvalFixtureReport = {
      ...completeFixtureReport(),
      id: "failed-topic",
      stageTimings: {
        ...createLiveEvalStageTimings(),
        routes: { status: "completed", durationMs: 120 },
        quest: { status: "completed", durationMs: 180 },
        evidence: {
          status: "failed",
          durationMs: 450,
          error: { name: "Error", message: "/api/evidence HTTP_503" },
        },
      },
      evidence: null,
      reflectionResult: null,
      mapSummary: null,
      checks: [
        { id: "routes:routes-exactly-three", passed: true, detail: "ok" },
        {
          id: "evidence:execution",
          passed: false,
          detail: "/api/evidence HTTP_503",
        },
      ],
      failure: {
        stage: "evidence",
        error: { name: "Error", message: "/api/evidence HTTP_503" },
      },
      passed: false,
    };

    const report = buildLiveEvaluationReport({
      startedAt: "2026-07-16T20:00:00.000Z",
      completedAt: "2026-07-16T20:00:05.000Z",
      targetOrigin: "https://wonderlab.example",
      timeoutMs: 45_000,
      requestedFixtureLimit: 2,
      fixtures: [passedFixture, failedFixture],
    });

    expect(report.summary).toMatchObject({
      passed: false,
      totalFixtures: 2,
      passedFixtures: 1,
      failedFixtures: 1,
      totalChecks: 4,
      passedChecks: 3,
      failedChecks: 1,
      failedStages: { evidence: 1 },
    });
    expect(report.fixtures[1]).toMatchObject({
      routes: passedFixture.routes,
      quest: passedFixture.quest,
      failure: {
        stage: "evidence",
        error: { message: "/api/evidence HTTP_503" },
      },
    });
  });

  it("redacts sensitive error values and emits a sanitized target origin", () => {
    const fakeKey = ["sk", "proj", "definitely-not-real"].join("-");
    const safetyIdentifier = "wonderlab_eval_private_fixture";
    const baseUrl =
      "https://user:password@preview.example/private?token=environment-value";
    const evidence = sanitizeLiveEvalError(
      new Error(
        `Request to ${baseUrl} failed for ${safetyIdentifier} with Bearer token-value and ${fakeKey}`,
      ),
      [baseUrl, safetyIdentifier],
    );

    expect(evidence.message).not.toContain(baseUrl);
    expect(evidence.message).not.toContain(safetyIdentifier);
    expect(evidence.message).not.toContain(fakeKey);
    expect(evidence.message).not.toContain("token-value");
    expect(evidence.message).toContain("[redacted]");
    expect(safeEvaluationTargetOrigin(baseUrl)).toBe("https://preview.example");
  });

  it("uses a stable timestamped path under the ignored output directory", () => {
    expect(
      liveEvaluationReportPath(
        "2026-07-16T20:00:00.123Z",
        "/workspace/wonderlab",
      ),
    ).toBe(
      "/workspace/wonderlab/output/evals/live-eval-2026-07-16T20-00-00-123Z.json",
    );
  });

  it("serializes only the explicit report contract", () => {
    const report = buildLiveEvaluationReport({
      startedAt: "2026-07-16T20:00:00.000Z",
      completedAt: "2026-07-16T20:00:01.000Z",
      targetOrigin: "http://localhost:3000",
      timeoutMs: 45_000,
      requestedFixtureLimit: 1,
      fixtures: [completeFixtureReport()],
    });
    const serialized = JSON.stringify(report);

    expect(serialized).toContain(CANONICAL_EVAL_FIXTURE.question);
    expect(serialized).toContain("sourceAssociations");
    expect(serialized).toContain("stageTimings");
    expect(serialized).toContain("evidenceDecision");
    expect(serialized).not.toContain("safetyIdentifier");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("hiddenPrompt");
    expect(report.run.runnerAccessedApiKey).toBe(false);
  });
});
