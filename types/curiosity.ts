export const SEEDED_FALLBACK_DISCLOSURE =
  "Demo quest loaded from a pre-generated sample because live generation was unavailable.";

export type LearnerLevel = "high_school" | "college" | "curious_adult";

export type QuestDuration = 5 | 10 | 15;

export type SessionMode = "live" | "seeded_fallback";

export type QuestStep =
  | "spark"
  | "choose"
  | "predict"
  | "investigate"
  | "create"
  | "reflect"
  | "branch";

export const NEXT_QUESTION_IDS = [
  "next-question-1",
  "next-question-2",
  "next-question-3",
] as const;

export type NextQuestionId = (typeof NEXT_QUESTION_IDS)[number];

export type ThinkingLens =
  "understand" | "challenge" | "create" | "compare" | "systems";

export interface ExplorationRoute {
  id: string;
  title: string;
  hook: string;
  lens: ThinkingLens;
  activityType: string;
  estimatedMinutes: number;
  iconKey: string;
}

export interface QuestPlan {
  routeId: string;
  timeBudget: import("@/lib/quest-time-budget").QuestTimeBudget;
  drivingQuestion: string;
  predictionPrompt: string;
  investigationPrompt: string;
  creationChallenge: string;
  constraints: string[];
  completionCriteria: string[];
  safetyNote: string;
  hint: string;
}

/**
 * A persisted quest created before duration-specific workload limits existed.
 * This marker is storage-only; newly generated and transitioned quests remain
 * `QuestPlan` values and cannot carry it.
 */
export interface LegacyStoredQuestPlan extends QuestPlan {
  workloadProfile: "pre_time_budget";
}

export type StoredQuestPlan = QuestPlan | LegacyStoredQuestPlan;

export interface SourceReference {
  id: string;
  title: string;
  url: string;
  domain: string;
}

export type EvidenceKind = "evidence" | "inference" | "open_question";

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  statement: string;
  sourceIds: string[];
}

export interface EvidenceBundle {
  items: EvidenceItem[];
  sources: SourceReference[];
  conciseExplanation: string;
  uncertaintyNote?: string;
}

export type EvidenceRelationship = "supports" | "challenges" | "complicates";

/** The learner's own judgment about one source-backed Evidence Lens finding. */
export interface EvidenceDecision {
  evidenceItemId: string;
  relationship: EvidenceRelationship;
  establishes: string;
  unresolved: string;
  impact: string;
}

/** One explicit learner-authored bridge from evidence into the creation. */
export interface EvidenceApplication {
  evidenceItemId: string;
  designChoice: string;
  /**
   * A short exact phrase the learner carries from the design choice into the
   * artifact. Optional only so previously saved v4 sessions remain readable.
   */
  artifactAnchor?: string;
}

export interface ReflectionInput {
  usedToThink: string;
  nowThink: string;
  stillWonder: string;
}

export type MapNodeKind =
  | "question"
  | "route"
  | "prediction"
  | "evidence"
  | "creation"
  | "reflection"
  | "next_question";

/**
 * A semantic suggestion from the model. Layout coordinates intentionally do not
 * belong here; the browser derives them deterministically.
 */
export interface SemanticMapDelta {
  nodeId: string;
  kind: "reflection" | "next_question";
  label: string;
  detail?: string;
  parentNodeId: string;
}

export interface ReflectionResult {
  specificFeedback: string;
  discoverySummary: string;
  changedThinking: string;
  keyTradeoff?: string;
  newQuestions: [string, string, string];
  mapDeltas: SemanticMapDelta[];
}

export interface CuriosityMapNode {
  id: string;
  kind: MapNodeKind;
  label: string;
  detail?: string;
}

export interface CuriosityMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface CuriosityMap {
  nodes: CuriosityMapNode[];
  edges: CuriosityMapEdge[];
}

export interface CuriositySession {
  id: string;
  createdAt: string;
  updatedAt: string;
  question: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  routes: ExplorationRoute[];
  selectedRouteId?: string;
  quest?: StoredQuestPlan;
  prediction?: string;
  evidence?: EvidenceBundle;
  evidenceDecision?: EvidenceDecision;
  evidenceApplication?: EvidenceApplication;
  artifact?: string;
  reflectionInput?: ReflectionInput;
  reflectionResult?: ReflectionResult;
  selectedNextQuestionId?: NextQuestionId;
  map?: CuriosityMap;
  mode: SessionMode;
  seededDisclosure?: string;
  step: QuestStep;
}

export interface RoutesRequest {
  question: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  safetyIdentifier: string;
}

export interface RoutesResponse {
  routes: [ExplorationRoute, ExplorationRoute, ExplorationRoute];
}

export interface QuestRequest {
  question: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  selectedRoute: ExplorationRoute;
  safetyIdentifier: string;
}

export interface EvidenceRequest {
  question: string;
  selectedRoute: ExplorationRoute;
  prediction: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  safetyIdentifier: string;
}

export interface ReflectRequest {
  question: string;
  route: ExplorationRoute;
  prediction: string;
  evidence: EvidenceBundle;
  evidenceDecision: EvidenceDecision;
  evidenceApplication: EvidenceApplication;
  artifact: string;
  reflection: ReflectionInput;
  safetyIdentifier: string;
}
