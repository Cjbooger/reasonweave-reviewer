import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WonderLabEvalFixture } from "@/evals/fixtures";
import type { EvaluationCheck } from "@/evals/validators";
import type {
  CuriosityMap,
  EvidenceBundle,
  EvidenceApplication,
  EvidenceDecision,
  EvidenceKind,
  ExplorationRoute,
  QuestPlan,
  ReflectionResult,
  SourceReference,
} from "@/types/curiosity";

export const LIVE_EVAL_REPORT_SCHEMA_VERSION = 2;
export const LIVE_EVAL_REPORT_DIRECTORY = "output/evals";
export const LIVE_EVAL_STAGES = [
  "routes",
  "quest",
  "evidence",
  "reflection",
  "map",
] as const;

export type LiveEvalStage = (typeof LIVE_EVAL_STAGES)[number];
export type LiveEvalStageStatus = "not_run" | "completed" | "failed";

export interface LiveEvalErrorEvidence {
  name: string;
  message: string;
}

export interface LiveEvalStageTiming {
  status: LiveEvalStageStatus;
  durationMs: number | null;
  error?: LiveEvalErrorEvidence;
}

export type LiveEvalStageTimings = Record<LiveEvalStage, LiveEvalStageTiming>;

export interface EvidenceSourceAssociation {
  itemId: string;
  kind: EvidenceKind;
  statement: string;
  sourceIds: string[];
  sources: SourceReference[];
  unresolvedSourceIds: string[];
}

export interface CuriosityMapSummary {
  nodeCount: number;
  edgeCount: number;
  nodeKinds: Record<string, number>;
  nodes: Array<{
    id: string;
    kind: string;
    label: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
}

export interface LiveEvalFixtureReport {
  id: string;
  question: string;
  settings: {
    level: WonderLabEvalFixture["level"];
    durationMinutes: WonderLabEvalFixture["durationMinutes"];
  };
  syntheticInput: {
    prediction: string;
    evidenceDecision: EvidenceDecision | null;
    evidenceApplication: EvidenceApplication | null;
    artifact: string;
    reflection: WonderLabEvalFixture["reflection"];
  };
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stageTimings: LiveEvalStageTimings;
  routes: ExplorationRoute[] | null;
  selectedRoute: ExplorationRoute | null;
  quest: QuestPlan | null;
  evidence: {
    bundle: EvidenceBundle;
    sourceAssociations: EvidenceSourceAssociation[];
  } | null;
  reflectionResult: ReflectionResult | null;
  mapSummary: CuriosityMapSummary | null;
  checks: EvaluationCheck[];
  failure: {
    stage: LiveEvalStage;
    error: LiveEvalErrorEvidence;
  } | null;
  passed: boolean;
}

export interface LiveEvaluationReport {
  schemaVersion: number;
  kind: "wonderlab-live-evaluation";
  generatedAt: string;
  run: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    targetOrigin: string;
    timeoutMs: number;
    requestedFixtureLimit: number;
    fixtureCount: number;
    runnerAccessedApiKey: false;
  };
  privacy: {
    syntheticFixturesOnly: true;
    excludes: string[];
  };
  fixtures: LiveEvalFixtureReport[];
  summary: {
    passed: boolean;
    totalFixtures: number;
    passedFixtures: number;
    failedFixtures: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    failedStages: Record<LiveEvalStage, number>;
  };
}

function durationBetween(startedAt: string, completedAt: string): number {
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

function replaceSensitiveValue(message: string, value: string): string {
  if (!value) return message;
  return message.split(value).join("[redacted]");
}

export function sanitizeLiveEvalError(
  error: unknown,
  sensitiveValues: readonly string[] = [],
): LiveEvalErrorEvidence {
  if (!(error instanceof Error)) {
    return {
      name: "Error",
      message: "Unknown live evaluation error.",
    };
  }

  let message = error.message || "Unknown live evaluation error.";
  for (const value of sensitiveValues) {
    message = replaceSensitiveValue(message, value);
  }
  message = message
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /\b((?:OPENAI_)?(?:API_?KEY|TOKEN|SECRET|PASSWORD))\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .slice(0, 800);

  return {
    name: error.name || "Error",
    message,
  };
}

export function safeEvaluationTargetOrigin(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("WONDERLAB_EVAL_BASE_URL must use HTTP or HTTPS.");
  }
  return url.origin;
}

export function createLiveEvalStageTimings(): LiveEvalStageTimings {
  return Object.fromEntries(
    LIVE_EVAL_STAGES.map((stage) => [
      stage,
      { status: "not_run", durationMs: null },
    ]),
  ) as LiveEvalStageTimings;
}

export function buildEvidenceSourceAssociations(
  bundle: EvidenceBundle,
): EvidenceSourceAssociation[] {
  const sourceById = new Map(
    bundle.sources.map((source) => [source.id, source]),
  );

  return bundle.items.map((item) => {
    const sources = item.sourceIds
      .map((sourceId) => sourceById.get(sourceId))
      .filter((source): source is SourceReference => source !== undefined);
    const unresolvedSourceIds = item.sourceIds.filter(
      (sourceId) => !sourceById.has(sourceId),
    );

    return {
      itemId: item.id,
      kind: item.kind,
      statement: item.statement,
      sourceIds: [...item.sourceIds],
      sources: sources.map((source) => ({ ...source })),
      unresolvedSourceIds,
    };
  });
}

export function summarizeCuriosityMap(map: CuriosityMap): CuriosityMapSummary {
  const nodeKinds: Record<string, number> = {};
  for (const node of map.nodes) {
    nodeKinds[node.kind] = (nodeKinds[node.kind] ?? 0) + 1;
  }

  return {
    nodeCount: map.nodes.length,
    edgeCount: map.edges.length,
    nodeKinds,
    nodes: map.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
    })),
    edges: map.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.label ? { label: edge.label } : {}),
    })),
  };
}

export function buildLiveEvaluationReport({
  startedAt,
  completedAt,
  targetOrigin,
  timeoutMs,
  requestedFixtureLimit,
  fixtures,
}: {
  startedAt: string;
  completedAt: string;
  targetOrigin: string;
  timeoutMs: number;
  requestedFixtureLimit: number;
  fixtures: LiveEvalFixtureReport[];
}): LiveEvaluationReport {
  const passedFixtures = fixtures.filter((fixture) => fixture.passed).length;
  const totalChecks = fixtures.reduce(
    (total, fixture) => total + fixture.checks.length,
    0,
  );
  const passedChecks = fixtures.reduce(
    (total, fixture) =>
      total + fixture.checks.filter((check) => check.passed).length,
    0,
  );
  const failedStages = Object.fromEntries(
    LIVE_EVAL_STAGES.map((stage) => [
      stage,
      fixtures.filter(
        (fixture) => fixture.stageTimings[stage].status === "failed",
      ).length,
    ]),
  ) as Record<LiveEvalStage, number>;

  return {
    schemaVersion: LIVE_EVAL_REPORT_SCHEMA_VERSION,
    kind: "wonderlab-live-evaluation",
    generatedAt: completedAt,
    run: {
      startedAt,
      completedAt,
      durationMs: durationBetween(startedAt, completedAt),
      targetOrigin,
      timeoutMs,
      requestedFixtureLimit,
      fixtureCount: fixtures.length,
      runnerAccessedApiKey: false,
    },
    privacy: {
      syntheticFixturesOnly: true,
      excludes: [
        "API keys and environment secrets",
        "request headers",
        "safety identifiers",
        "hidden prompts and server instructions",
      ],
    },
    fixtures,
    summary: {
      passed: fixtures.length > 0 && passedFixtures === fixtures.length,
      totalFixtures: fixtures.length,
      passedFixtures,
      failedFixtures: fixtures.length - passedFixtures,
      totalChecks,
      passedChecks,
      failedChecks: totalChecks - passedChecks,
      failedStages,
    },
  };
}

export function liveEvaluationReportPath(
  startedAt: string,
  rootDirectory = process.cwd(),
): string {
  const parsed = new Date(startedAt);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error("Live evaluation report timestamp is invalid.");
  }
  const timestamp = parsed.toISOString().replace(/[:.]/g, "-");
  return path.join(
    rootDirectory,
    LIVE_EVAL_REPORT_DIRECTORY,
    `live-eval-${timestamp}.json`,
  );
}

export async function writeLiveEvaluationReport(
  reportPath: string,
  report: LiveEvaluationReport,
): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
