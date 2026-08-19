export const CANONICAL_UNDERWATER_QUESTION =
  "Could humans live underwater?" as const;

function normalizeQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function isCanonicalUnderwaterQuestion(question: string): boolean {
  return (
    normalizeQuestion(question) ===
    normalizeQuestion(CANONICAL_UNDERWATER_QUESTION)
  );
}
