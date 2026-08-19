import {
  evidenceApplicationSchema,
  evidenceDecisionSchema,
} from "@/lib/schemas";
import type {
  EvidenceApplication,
  EvidenceBundle,
  EvidenceDecision,
} from "@/types/curiosity";

/**
 * Builds a deterministic, synthetic learner judgment for credentialed evals.
 * The live runner evaluates product coherence; it never treats this fixture text
 * as evidence of a real learner outcome.
 */
export function buildSyntheticEvidenceDecision(
  evidence: EvidenceBundle,
): EvidenceDecision {
  const selectedFinding = evidence.items.find(
    (item) => item.kind === "evidence" && item.sourceIds.length > 0,
  );
  if (!selectedFinding) {
    throw new Error(
      "The live evaluation requires a source-backed evidence finding.",
    );
  }

  return evidenceDecisionSchema.parse({
    evidenceItemId: selectedFinding.id,
    relationship: "complicates",
    establishes:
      "This source-backed finding establishes one real constraint in the current evidence.",
    unresolved:
      "It does not establish whether that constraint remains the dominant limit at a larger scale.",
    impact:
      "That boundary complicates my initial prediction, so I need a more connected model.",
  });
}

export function buildSyntheticEvidenceApplication(
  decision: EvidenceDecision,
  application: Omit<EvidenceApplication, "evidenceItemId">,
): EvidenceApplication {
  return evidenceApplicationSchema.parse({
    ...application,
    evidenceItemId: decision.evidenceItemId,
  });
}
