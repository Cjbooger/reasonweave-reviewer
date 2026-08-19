import type { CuriositySession } from "@/types/curiosity";

import type { DraftState } from "./types";

export function isProviderFreeBranch(session: CuriositySession): boolean {
  return session.step === "branch";
}

export function hasDraftLearnerWork(draft: DraftState): boolean {
  return Boolean(
    draft.question.trim() ||
    draft.prediction.trim() ||
    draft.evidenceDecision.evidenceItemId ||
    draft.evidenceDecision.relationship ||
    draft.evidenceDecision.establishes.trim() ||
    draft.evidenceDecision.unresolved.trim() ||
    draft.evidenceDecision.impact.trim() ||
    draft.compactEvidenceNote.trim() ||
    draft.evidenceApplicationChoice.trim() ||
    draft.artifactAnchor.trim() ||
    draft.artifact.trim() ||
    draft.reflection.usedToThink.trim() ||
    draft.reflection.nowThink.trim() ||
    draft.reflection.stillWonder.trim(),
  );
}

export function createSafetyIdentifier(): string {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    ? `wl_${random}`
    : `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 18)}`;
}
