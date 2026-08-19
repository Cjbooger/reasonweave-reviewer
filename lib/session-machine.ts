import { buildFinalCuriosityMap } from "@/lib/map";
import { validateEvidenceApplicationArtifact } from "@/lib/evidence-application";
import {
  isLegacyFiveMinuteTimeBudget,
  questTimeBudgetFor,
  questWorkloadLimitsFor,
} from "@/lib/quest-time-budget";
import {
  artifactSchema,
  curiositySessionSchema,
  evidenceApplicationSchema,
  evidenceDecisionSchema,
  evidenceBundleSchema,
  nextQuestionIdSchema,
  predictionSchema,
  questPlanSchema,
  questionSchema,
  reflectionInputSchema,
  reflectionResultSchema,
  routesResponseSchema,
  seededDemoSessionSchema,
} from "@/lib/schemas";
import {
  SEEDED_FALLBACK_DISCLOSURE,
  type CuriositySession,
  type EvidenceApplication,
  type EvidenceDecision,
  type EvidenceBundle,
  type ExplorationRoute,
  type LearnerLevel,
  type NextQuestionId,
  type QuestDuration,
  type QuestPlan,
  type QuestStep,
  type ReflectionInput,
  type ReflectionResult,
  type SessionMode,
} from "@/types/curiosity";

export interface CreateSessionInput {
  question: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  mode?: SessionMode;
}

export interface CreateSessionOptions {
  id?: string;
  now?: string | Date;
}

interface TimedEvent {
  at?: string | Date;
}

export type SessionEvent =
  | ({ type: "ROUTES_GENERATED"; routes: ExplorationRoute[] } & TimedEvent)
  | ({ type: "ROUTE_SELECTED"; routeId: string } & TimedEvent)
  | ({ type: "QUEST_LOADED"; quest: QuestPlan } & TimedEvent)
  | ({ type: "PREDICTION_SUBMITTED"; prediction: string } & TimedEvent)
  | ({ type: "EVIDENCE_LOADED"; evidence: EvidenceBundle } & TimedEvent)
  | ({
      type: "ARTIFACT_SUBMITTED";
      artifact: string;
      evidenceDecision: EvidenceDecision;
      evidenceApplication: EvidenceApplication;
    } & TimedEvent)
  | ({
      type: "REFLECTION_COMPLETED";
      reflectionInput: ReflectionInput;
      reflectionResult: ReflectionResult;
    } & TimedEvent)
  | ({
      type: "NEXT_QUESTION_SELECTED";
      nextQuestionId: NextQuestionId;
    } & TimedEvent);

export type SessionTransitionErrorCode =
  | "invalid_transition"
  | "invalid_payload"
  | "missing_route"
  | "prediction_required";

export class SessionTransitionError extends Error {
  readonly code: SessionTransitionErrorCode;
  readonly cause?: unknown;

  constructor(
    code: SessionTransitionErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "SessionTransitionError";
    this.code = code;
    this.cause = cause;
  }
}

function randomSessionId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `wonder-${randomUuid}`;

  return `wonder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function timestamp(value?: string | Date): string {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new SessionTransitionError(
      "invalid_payload",
      "Session timestamp must be a valid date.",
    );
  }
  return date.toISOString();
}

function requireStep(
  session: CuriositySession,
  allowedSteps: readonly QuestStep[],
  eventType: SessionEvent["type"],
): void {
  if (!allowedSteps.includes(session.step)) {
    throw new SessionTransitionError(
      "invalid_transition",
      `${eventType} is not allowed during the ${session.step} step.`,
    );
  }
}

function parseSession(candidate: unknown): CuriositySession {
  const result = curiositySessionSchema.safeParse(candidate);
  if (!result.success) {
    throw new SessionTransitionError(
      "invalid_payload",
      result.error.issues[0]?.message ?? "Session data is invalid.",
      result.error,
    );
  }
  return result.data;
}

function identityFields(
  session: CuriositySession,
  updatedAt: string,
): Pick<
  CuriositySession,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "question"
  | "level"
  | "durationMinutes"
  | "mode"
  | "seededDisclosure"
> {
  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt,
    question: session.question,
    level: session.level,
    durationMinutes: session.durationMinutes,
    mode: session.mode,
    ...(session.seededDisclosure
      ? { seededDisclosure: session.seededDisclosure }
      : {}),
  };
}

export function createCuriositySession(
  input: CreateSessionInput,
  options: CreateSessionOptions = {},
): CuriositySession {
  const createdAt = timestamp(options.now);
  const question = questionSchema.parse(input.question);
  const mode = input.mode ?? "live";

  return parseSession({
    id: options.id ?? randomSessionId(),
    createdAt,
    updatedAt: createdAt,
    question,
    level: input.level,
    durationMinutes: input.durationMinutes,
    routes: [],
    mode,
    ...(mode === "seeded_fallback"
      ? { seededDisclosure: SEEDED_FALLBACK_DISCLOSURE }
      : {}),
    step: "spark",
  });
}

export function transitionSession(
  session: CuriositySession,
  event: SessionEvent,
): CuriositySession {
  const current = parseSession(session);
  const updatedAt = timestamp(event.at);

  if (Date.parse(updatedAt) < Date.parse(current.updatedAt)) {
    throw new SessionTransitionError(
      "invalid_payload",
      "A session transition cannot move updatedAt backwards.",
    );
  }

  switch (event.type) {
    case "ROUTES_GENERATED": {
      requireStep(current, ["spark", "choose"], event.type);
      const { routes } = routesResponseSchema.parse({ routes: event.routes });

      return parseSession({
        ...identityFields(current, updatedAt),
        routes,
        step: "choose",
      });
    }

    case "ROUTE_SELECTED": {
      requireStep(current, ["choose"], event.type);
      if (!current.routes.some((route) => route.id === event.routeId)) {
        throw new SessionTransitionError(
          "missing_route",
          "Choose one of the three available investigation routes.",
        );
      }

      return parseSession({
        ...identityFields(current, updatedAt),
        routes: current.routes,
        selectedRouteId: event.routeId,
        step: "choose",
      });
    }

    case "QUEST_LOADED": {
      requireStep(current, ["choose"], event.type);
      if (!current.selectedRouteId) {
        throw new SessionTransitionError(
          "missing_route",
          "Select an investigation route before loading its quest.",
        );
      }

      const quest = questPlanSchema.parse(event.quest);
      if (quest.routeId !== current.selectedRouteId) {
        throw new SessionTransitionError(
          "invalid_payload",
          "The quest plan does not belong to the selected route.",
        );
      }

      return parseSession({
        ...identityFields(current, updatedAt),
        routes: current.routes,
        selectedRouteId: current.selectedRouteId,
        quest,
        step: "predict",
      });
    }

    case "PREDICTION_SUBMITTED": {
      requireStep(current, ["predict"], event.type);
      const prediction = predictionSchema.parse(event.prediction);

      return parseSession({
        ...current,
        updatedAt,
        prediction,
        step: "investigate",
      });
    }

    case "EVIDENCE_LOADED": {
      requireStep(current, ["investigate"], event.type);
      if (!current.prediction) {
        throw new SessionTransitionError(
          "prediction_required",
          "Submit a meaningful prediction before revealing evidence.",
        );
      }
      const evidence = evidenceBundleSchema.parse(event.evidence);

      return parseSession({
        ...current,
        updatedAt,
        evidence,
        step: "create",
      });
    }

    case "ARTIFACT_SUBMITTED": {
      requireStep(current, ["create"], event.type);
      const artifact = artifactSchema.parse(event.artifact);
      const evidenceDecision = evidenceDecisionSchema.parse(
        event.evidenceDecision,
      );
      const evidenceApplication = evidenceApplicationSchema.parse(
        event.evidenceApplication,
      );
      const selectedEvidence = current.evidence?.items.find(
        (item) => item.id === evidenceDecision.evidenceItemId,
      );
      if (
        !selectedEvidence ||
        selectedEvidence.kind !== "evidence" ||
        selectedEvidence.sourceIds.length === 0
      ) {
        throw new SessionTransitionError(
          "invalid_payload",
          "Choose a source-backed evidence finding from the current Evidence Lens.",
        );
      }
      if (
        evidenceApplication.evidenceItemId !== evidenceDecision.evidenceItemId
      ) {
        throw new SessionTransitionError(
          "invalid_payload",
          "Link the design choice to the source-backed finding you judged.",
        );
      }
      const applicationArtifact = validateEvidenceApplicationArtifact(
        evidenceApplication,
        artifact,
      );
      if (!applicationArtifact.success) {
        throw new SessionTransitionError(
          "invalid_payload",
          applicationArtifact.message ??
            "Make the evidence-driven design move visible in the creation.",
        );
      }

      return parseSession({
        ...current,
        updatedAt,
        evidenceDecision,
        evidenceApplication,
        artifact,
        step: "reflect",
      });
    }

    case "REFLECTION_COMPLETED": {
      requireStep(current, ["reflect"], event.type);
      const reflectionInput = reflectionInputSchema.parse(
        event.reflectionInput,
      );
      const reflectionResult = reflectionResultSchema.parse(
        event.reflectionResult,
      );
      const withoutMap = parseSession({
        ...current,
        updatedAt,
        reflectionInput,
        reflectionResult,
        step: "reflect",
      });
      const map = buildFinalCuriosityMap(withoutMap);

      return parseSession({
        ...withoutMap,
        map,
        step: "branch",
      });
    }

    case "NEXT_QUESTION_SELECTED": {
      requireStep(current, ["branch"], event.type);
      const selectedNextQuestionId = nextQuestionIdSchema.parse(
        event.nextQuestionId,
      );
      const withSelection = {
        ...current,
        updatedAt,
        selectedNextQuestionId,
      };
      const map = buildFinalCuriosityMap(withSelection);

      return parseSession({
        ...withSelection,
        map,
      });
    }
  }
}

/** React-compatible reducer alias. */
export const sessionReducer = transitionSession;

export function canRevealEvidence(session: CuriositySession): boolean {
  return (
    Boolean(session.prediction) &&
    ["investigate", "create", "reflect", "branch"].includes(session.step)
  );
}

export function getSelectedRoute(
  session: CuriositySession,
): ExplorationRoute | undefined {
  return session.routes.find((route) => route.id === session.selectedRouteId);
}

export function loadSeededSession(input: unknown): CuriositySession {
  return seededDemoSessionSchema.parse(input);
}

/** Upgrades valid v4 learner-work records before strict schema validation. */
export function migrateStoredCuriositySession(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const session = input as Record<string, unknown>;
  const quest = session.quest;
  const durationMinutes = session.durationMinutes;
  const questRecord =
    quest && typeof quest === "object" && !Array.isArray(quest)
      ? (quest as Record<string, unknown>)
      : undefined;
  const hasTimeBudget = Boolean(
    questRecord && Object.hasOwn(questRecord, "timeBudget"),
  );
  const hasLegacyFiveMinuteBudget =
    durationMinutes === 5 &&
    isLegacyFiveMinuteTimeBudget(questRecord?.timeBudget);

  let migrated: Record<string, unknown> = session;

  if (
    questRecord &&
    (!hasTimeBudget || hasLegacyFiveMinuteBudget) &&
    (durationMinutes === 5 || durationMinutes === 10 || durationMinutes === 15)
  ) {
    const workload = questWorkloadLimitsFor(durationMinutes);
    const exceedsFocusedWorkload =
      (Array.isArray(questRecord.constraints) &&
        questRecord.constraints.length > workload.constraints.max) ||
      (Array.isArray(questRecord.completionCriteria) &&
        questRecord.completionCriteria.length >
          workload.completionCriteria.max);

    migrated = {
      ...migrated,
      quest: {
        ...questRecord,
        timeBudget: questTimeBudgetFor(durationMinutes),
        ...(exceedsFocusedWorkload
          ? { workloadProfile: "pre_time_budget" as const }
          : {}),
      },
    };
  }

  const evidenceApplication = migrated.evidenceApplication;
  const applicationRecord =
    evidenceApplication &&
    typeof evidenceApplication === "object" &&
    !Array.isArray(evidenceApplication)
      ? (evidenceApplication as Record<string, unknown>)
      : undefined;
  const artifactAnchor = applicationRecord?.artifactAnchor;

  // A saved pre-anchor Reflect session cannot expose the new Create-only
  // control or satisfy the strict reflection request. Return it to Create with
  // all learner work intact so the learner can choose the exact bridge phrase
  // themselves; never invent or silently rewrite their prior response.
  if (
    migrated.step === "reflect" &&
    applicationRecord &&
    (typeof artifactAnchor !== "string" || artifactAnchor.trim().length === 0)
  ) {
    migrated = { ...migrated, step: "create" };
  }

  return migrated === session ? input : migrated;
}
