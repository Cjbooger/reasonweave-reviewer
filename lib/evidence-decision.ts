import type { EvidenceDecision } from "@/types/curiosity";

/**
 * Joins the learner's three explicit evidence judgments for prompt-grounding
 * and quality checks that operate on a single learner-authored passage.
 */
export function evidenceDecisionNarrative(
  decision: Pick<EvidenceDecision, "establishes" | "unresolved" | "impact">,
): string {
  return [decision.establishes, decision.unresolved, decision.impact]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
}

/** Keeps the map boundary concise without inferring it from a free-form essay. */
export function conciseUnresolvedClaim(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?…]+$/, "")
    .replace(
      /^(?:(?:the|this) (?:selected )?finding|the cited sources?|these sources?|it) (?:do|does) not (?:establish|show|prove|settle|confirm) (?:that )?/i,
      "",
    )
    .replace(/^unresolved:\s*/i, "")
    .replace(/\s+(?:remain|remains) unresolved$/i, "")
    .trim();

  return normalized || value.trim();
}
