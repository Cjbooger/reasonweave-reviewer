import type {
  EvidenceRelationship,
  LearnerLevel,
  QuestDuration,
  ReflectionInput,
} from "@/types/curiosity";

export type RetryStage = "routes" | "quest" | "evidence" | "reflection";

export interface UiError {
  title: string;
  message: string;
  retryStage: RetryStage;
  retryable: boolean;
}

export interface LoadingState {
  stage: RetryStage;
  message: string;
}

export interface EvidenceDecisionDraft {
  evidenceItemId: string;
  relationship: EvidenceRelationship | "";
  establishes: string;
  unresolved: string;
  impact: string;
}

export interface DraftState {
  question: string;
  level: LearnerLevel;
  durationMinutes: QuestDuration;
  prediction: string;
  evidenceDecision: EvidenceDecisionDraft;
  compactEvidenceNote: string;
  evidenceApplicationChoice: string;
  artifactAnchor: string;
  artifact: string;
  reflection: ReflectionInput;
}

export type CompactEvidenceNoteResult =
  | {
      success: true;
      data: Pick<
        EvidenceDecisionDraft,
        "establishes" | "unresolved" | "impact"
      >;
    }
  | { success: false; message: string };
