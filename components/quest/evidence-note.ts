import type { CompactEvidenceNoteResult, EvidenceDecisionDraft } from "./types";

export function parseCompactEvidenceNote(
  value: string,
): CompactEvidenceNoteResult {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d[.)]\s*/, "").trim());

  if (lines.length !== 3) {
    return {
      success: false,
      message:
        "Write exactly three short lines: what the sources show, where their scope stops, and why that matters for your prediction.",
    };
  }

  const labels = [
    "What the sources show",
    "Where their scope stops",
    "Why that matters",
  ] as const;
  for (const [index, line] of lines.entries()) {
    if (line.length < 15 || line.length > 300) {
      return {
        success: false,
        message: `${labels[index]} must be 15–300 characters on line ${index + 1}.`,
      };
    }
  }

  return {
    success: true,
    data: {
      establishes: lines[0],
      unresolved: lines[1],
      impact: lines[2],
    },
  };
}

export function formatCompactEvidenceNote(
  decision: Pick<
    EvidenceDecisionDraft,
    "establishes" | "unresolved" | "impact"
  >,
): string {
  return [decision.establishes, decision.unresolved, decision.impact]
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
