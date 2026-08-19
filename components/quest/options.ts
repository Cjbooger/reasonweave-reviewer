import type {
  EvidenceRelationship,
  LearnerLevel,
  QuestDuration,
  ReflectionInput,
} from "@/types/curiosity";

import type { EvidenceDecisionDraft } from "./types";

export const EMPTY_REFLECTION: ReflectionInput = {
  usedToThink: "",
  nowThink: "",
  stillWonder: "",
};

export const EMPTY_EVIDENCE_DECISION: EvidenceDecisionDraft = {
  evidenceItemId: "",
  relationship: "",
  establishes: "",
  unresolved: "",
  impact: "",
};

export const LEVELS: Array<{ value: LearnerLevel; label: string }> = [
  { value: "high_school", label: "High school" },
  { value: "college", label: "College" },
  { value: "curious_adult", label: "Curious adult" },
];

export const DURATIONS: QuestDuration[] = [5, 10, 15];

export const EVIDENCE_RELATIONSHIPS: ReadonlyArray<{
  value: EvidenceRelationship;
  label: string;
}> = [
  { value: "supports", label: "Supports my prediction" },
  { value: "challenges", label: "Challenges my prediction" },
  { value: "complicates", label: "Complicates my prediction" },
];
