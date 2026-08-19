import { evidenceDecisionNarrative } from "@/lib/evidence-decision";
import { buildFinalCuriosityMap } from "@/lib/map";
import {
  evidenceBundleSchema,
  questPlanSchema,
  reflectionResultSchema,
  routesResponseSchema,
} from "@/lib/schemas";
import type {
  CuriositySession,
  EvidenceApplication,
  EvidenceBundle,
  EvidenceDecision,
  ExplorationRoute,
  QuestPlan,
  ReflectionResult,
} from "@/types/curiosity";

import {
  buildSyntheticEvidenceApplication,
  buildSyntheticEvidenceDecision,
} from "./evidence-decision";
import { EVAL_FIXTURES, type WonderLabEvalFixture } from "./fixtures";
import {
  buildEvidenceSourceAssociations,
  buildLiveEvaluationReport,
  createLiveEvalStageTimings,
  liveEvaluationReportPath,
  safeEvaluationTargetOrigin,
  sanitizeLiveEvalError,
  summarizeCuriosityMap,
  type LiveEvalErrorEvidence,
  type LiveEvalFixtureReport,
  type LiveEvalStage,
  type LiveEvalStageTimings,
  writeLiveEvaluationReport,
} from "./live-report";
import {
  type EvaluationCheck,
  type EvaluationResult,
  failedDetails,
  validateCuriosityMap,
  validateEvidenceDecisionGrounding,
  validateEvidenceBundle,
  validateQuestPlan,
  validateReflectionResult,
  validateRoutes,
} from "./validators";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 45_000;

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function schemaFailure(name: string, issues: readonly string[]): Error {
  return new Error(`${name} failed schema validation: ${issues.join("; ")}`);
}

function zodIssues(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
}): string[] {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`);
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => undefined)) as
      ApiErrorEnvelope | unknown;
    if (!response.ok) {
      const error = payload as ApiErrorEnvelope | undefined;
      const code = error?.error?.code ?? `HTTP_${response.status}`;
      const message =
        error?.error?.message ??
        "The application returned a non-success response.";
      throw new Error(`${path} ${code}: ${message}`);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${path} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function chooseRoute(routes: readonly ExplorationRoute[]): ExplorationRoute {
  return (
    routes.find((route) =>
      ["create", "systems", "compare"].includes(route.lens),
    ) ?? routes[0]
  );
}

function prefixChecks(
  stage: string,
  evaluation: EvaluationResult,
): EvaluationCheck[] {
  return evaluation.checks.map((item) => ({
    ...item,
    id: `${stage}:${item.id}`,
  }));
}

class LiveEvalStageError extends Error {
  readonly stage: LiveEvalStage;
  readonly evidence: LiveEvalErrorEvidence;

  constructor(stage: LiveEvalStage, evidence: LiveEvalErrorEvidence) {
    super(evidence.message);
    this.name = "LiveEvalStageError";
    this.stage = stage;
    this.evidence = evidence;
  }
}

async function runRecordedStage<T>(
  stage: LiveEvalStage,
  stageTimings: LiveEvalStageTimings,
  sensitiveValues: readonly string[],
  operation: () => Promise<T> | T,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await operation();
    stageTimings[stage] = {
      status: "completed",
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
    return result;
  } catch (error) {
    const evidence = sanitizeLiveEvalError(error, sensitiveValues);
    stageTimings[stage] = {
      status: "failed",
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      error: evidence,
    };
    throw new LiveEvalStageError(stage, evidence);
  }
}

async function evaluateFixture(
  fixture: WonderLabEvalFixture,
  baseUrl: string,
  timeoutMs: number,
): Promise<LiveEvalFixtureReport> {
  const safetyIdentifier = `wonderlab_eval_${fixture.id}`;
  const sensitiveValues = [baseUrl, safetyIdentifier];
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const stageTimings = createLiveEvalStageTimings();
  const checks: EvaluationCheck[] = [];
  let routes: ExplorationRoute[] | null = null;
  let selectedRoute: ExplorationRoute | null = null;
  let quest: QuestPlan | null = null;
  let evidence: EvidenceBundle | null = null;
  let evidenceDecision: EvidenceDecision | null = null;
  let evidenceApplication: EvidenceApplication | null = null;
  let reflectionResult: ReflectionResult | null = null;
  let mapSummary: ReturnType<typeof summarizeCuriosityMap> | null = null;
  let failure: LiveEvalFixtureReport["failure"] = null;

  try {
    const parsedRoutes = await runRecordedStage(
      "routes",
      stageTimings,
      sensitiveValues,
      async () => {
        const routesPayload = await postJson(
          baseUrl,
          "/api/routes",
          {
            question: fixture.question,
            level: fixture.level,
            durationMinutes: fixture.durationMinutes,
            safetyIdentifier,
          },
          timeoutMs,
        );
        const parsed = routesResponseSchema.safeParse(routesPayload);
        if (!parsed.success) {
          throw schemaFailure("routes", zodIssues(parsed.error));
        }
        checks.push(
          ...prefixChecks("routes", validateRoutes(parsed.data.routes)),
        );
        return parsed.data.routes;
      },
    );
    routes = [...parsedRoutes];
    const chosenRoute = chooseRoute(parsedRoutes);
    selectedRoute = chosenRoute;

    const parsedQuest = await runRecordedStage(
      "quest",
      stageTimings,
      sensitiveValues,
      async () => {
        const questPayload = await postJson(
          baseUrl,
          "/api/quest",
          {
            question: fixture.question,
            level: fixture.level,
            durationMinutes: fixture.durationMinutes,
            selectedRoute: chosenRoute,
            safetyIdentifier,
          },
          timeoutMs,
        );
        const parsed = questPlanSchema.safeParse(questPayload);
        if (!parsed.success) {
          throw schemaFailure("quest", zodIssues(parsed.error));
        }
        checks.push(
          ...prefixChecks(
            "quest",
            validateQuestPlan(parsed.data, fixture.durationMinutes),
          ),
        );
        return parsed.data;
      },
    );
    quest = parsedQuest;

    const parsedEvidence = await runRecordedStage(
      "evidence",
      stageTimings,
      sensitiveValues,
      async () => {
        const evidencePayload = await postJson(
          baseUrl,
          "/api/evidence",
          {
            question: fixture.question,
            selectedRoute: chosenRoute,
            prediction: fixture.prediction,
            level: fixture.level,
            durationMinutes: fixture.durationMinutes,
            safetyIdentifier,
          },
          timeoutMs,
        );
        const parsed = evidenceBundleSchema.safeParse(evidencePayload);
        if (!parsed.success) {
          throw schemaFailure("evidence", zodIssues(parsed.error));
        }
        checks.push(
          ...prefixChecks("evidence", validateEvidenceBundle(parsed.data)),
        );
        return parsed.data;
      },
    );
    evidence = parsedEvidence;
    const syntheticEvidenceDecision =
      buildSyntheticEvidenceDecision(parsedEvidence);
    const syntheticEvidenceApplication = buildSyntheticEvidenceApplication(
      syntheticEvidenceDecision,
      fixture.evidenceApplication,
    );
    evidenceDecision = syntheticEvidenceDecision;
    evidenceApplication = syntheticEvidenceApplication;

    const parsedReflection = await runRecordedStage(
      "reflection",
      stageTimings,
      sensitiveValues,
      async () => {
        const reflectionPayload = await postJson(
          baseUrl,
          "/api/reflect",
          {
            question: fixture.question,
            route: chosenRoute,
            prediction: fixture.prediction,
            evidence: parsedEvidence,
            evidenceDecision: syntheticEvidenceDecision,
            evidenceApplication: syntheticEvidenceApplication,
            artifact: fixture.artifact,
            reflection: { ...fixture.reflection },
            safetyIdentifier,
          },
          timeoutMs,
        );
        const parsed = reflectionResultSchema.safeParse(reflectionPayload);
        if (!parsed.success) {
          throw schemaFailure("reflection", zodIssues(parsed.error));
        }
        checks.push(
          ...prefixChecks(
            "reflection",
            validateReflectionResult(parsed.data, fixture.reflection, [
              fixture.prediction,
              evidenceDecisionNarrative(syntheticEvidenceDecision),
              syntheticEvidenceApplication.designChoice,
              fixture.artifact,
            ]),
          ),
          ...prefixChecks(
            "reflection-decision",
            validateEvidenceDecisionGrounding(
              parsed.data,
              parsedEvidence,
              syntheticEvidenceDecision,
              syntheticEvidenceApplication,
            ),
          ),
        );
        return parsed.data;
      },
    );
    reflectionResult = parsedReflection;

    mapSummary = await runRecordedStage(
      "map",
      stageTimings,
      sensitiveValues,
      () => {
        const timestamp = new Date().toISOString();
        const session: CuriositySession = {
          id: `eval-${fixture.id}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          question: fixture.question,
          level: fixture.level,
          durationMinutes: fixture.durationMinutes,
          routes: [...parsedRoutes],
          selectedRouteId: chosenRoute.id,
          quest: parsedQuest,
          prediction: fixture.prediction,
          evidence: parsedEvidence,
          evidenceDecision: syntheticEvidenceDecision,
          evidenceApplication: syntheticEvidenceApplication,
          artifact: fixture.artifact,
          reflectionInput: { ...fixture.reflection },
          reflectionResult: parsedReflection,
          mode: "live",
          step: "branch",
        };
        const map = buildFinalCuriosityMap(session);
        checks.push(...prefixChecks("map", validateCuriosityMap(map)));
        return summarizeCuriosityMap(map);
      },
    );
  } catch (error) {
    const stageError =
      error instanceof LiveEvalStageError
        ? error
        : new LiveEvalStageError(
            "routes",
            sanitizeLiveEvalError(error, sensitiveValues),
          );
    failure = {
      stage: stageError.stage,
      error: stageError.evidence,
    };
    checks.push({
      id: `${stageError.stage}:execution`,
      passed: false,
      detail: stageError.evidence.message,
    });
  }

  const completedAt = new Date().toISOString();
  return {
    id: fixture.id,
    question: fixture.question,
    settings: {
      level: fixture.level,
      durationMinutes: fixture.durationMinutes,
    },
    syntheticInput: {
      prediction: fixture.prediction,
      evidenceDecision,
      evidenceApplication,
      artifact: fixture.artifact,
      reflection: { ...fixture.reflection },
    },
    startedAt,
    completedAt,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    stageTimings,
    routes,
    selectedRoute,
    quest,
    evidence: evidence
      ? {
          bundle: evidence,
          sourceAssociations: buildEvidenceSourceAssociations(evidence),
        }
      : null,
    reflectionResult,
    mapSummary,
    checks,
    failure,
    passed: checks.length > 0 && checks.every((item) => item.passed),
  };
}

function printEvaluation(evaluation: EvaluationResult): void {
  process.stdout.write(
    `${evaluation.passed ? "PASS" : "FAIL"} ${evaluation.name}\n`,
  );
  for (const detail of failedDetails(evaluation)) {
    process.stdout.write(`  - ${detail}\n`);
  }
}

async function main(): Promise<void> {
  const baseUrl = (
    process.env.WONDERLAB_EVAL_BASE_URL ?? DEFAULT_BASE_URL
  ).replace(/\/$/, "");
  const targetOrigin = safeEvaluationTargetOrigin(baseUrl);
  const timeoutMs = positiveInteger(
    process.env.WONDERLAB_EVAL_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    "WONDERLAB_EVAL_TIMEOUT_MS",
  );
  const limit = positiveInteger(
    process.env.WONDERLAB_EVAL_LIMIT,
    EVAL_FIXTURES.length,
    "WONDERLAB_EVAL_LIMIT",
  );
  const fixtures = EVAL_FIXTURES.slice(
    0,
    Math.min(limit, EVAL_FIXTURES.length),
  );
  const runStartedAt = new Date().toISOString();
  const reportPath = liveEvaluationReportPath(runStartedAt);

  process.stdout.write(
    `Running ${fixtures.length} live ReasonWeave evaluation(s) against ${targetOrigin}.\n`,
  );
  process.stdout.write(
    "This runner tests application API behavior; it never reads or prints OPENAI_API_KEY.\n\n",
  );

  const fixtureReports: LiveEvalFixtureReport[] = [];
  for (const fixture of fixtures) {
    const fixtureReport = await evaluateFixture(fixture, baseUrl, timeoutMs);
    fixtureReports.push(fixtureReport);
    printEvaluation({
      name: fixtureReport.id,
      passed: fixtureReport.passed,
      checks: fixtureReport.checks,
    });
  }

  const report = buildLiveEvaluationReport({
    startedAt: runStartedAt,
    completedAt: new Date().toISOString(),
    targetOrigin,
    timeoutMs,
    requestedFixtureLimit: limit,
    fixtures: fixtureReports,
  });
  await writeLiveEvaluationReport(reportPath, report);

  process.stdout.write(
    `\nLive evaluation summary: ${report.summary.passedFixtures} passed, ${report.summary.failedFixtures} failed, ${report.summary.totalFixtures} total.\n`,
  );
  process.stdout.write(`Reviewable JSON report: ${reportPath}\n`);
  if (!report.summary.passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Live evaluation configuration failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
