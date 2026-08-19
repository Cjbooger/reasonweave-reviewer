import type { EvidenceApplication } from "@/types/curiosity";

export const ARTIFACT_ANCHOR_MIN_WORDS = 2;
export const ARTIFACT_ANCHOR_MAX_WORDS = 8;
export const ARTIFACT_ANCHOR_MAX_CHARACTERS = 80;

const CONNECTOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "anchor",
  "as",
  "at",
  "artifact",
  "because",
  "but",
  "by",
  "choice",
  "creation",
  "design",
  "evidence",
  "finding",
  "for",
  "from",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "learner",
  "phrase",
  "response",
  "selected",
  "so",
  "source",
  "that",
  "the",
  "this",
  "to",
  "we",
  "will",
  "with",
  "would",
]);

interface AnchorToken {
  normalized: string;
  original: string;
}

export interface EvidenceApplicationArtifactValidation {
  field?: "artifact" | "artifactAnchor";
  message?: string;
  success: boolean;
}

function anchorTokens(value: string): AnchorToken[] {
  return (value.normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? []).map(
    (original) => ({
      normalized: original.toLocaleLowerCase("en-US"),
      original,
    }),
  );
}

function containsTokenSequence(
  textTokens: readonly AnchorToken[],
  phraseTokens: readonly AnchorToken[],
): boolean {
  if (phraseTokens.length === 0 || phraseTokens.length > textTokens.length) {
    return false;
  }

  return textTokens.some((_, start) =>
    phraseTokens.every(
      (token, offset) =>
        textTokens[start + offset]?.normalized === token.normalized,
    ),
  );
}

function meaningfulTokenCount(tokens: readonly AnchorToken[]): number {
  return tokens.filter(
    ({ normalized }) =>
      normalized.length > 1 && !CONNECTOR_WORDS.has(normalized),
  ).length;
}

export function artifactAnchorWordCount(value: string): number {
  return anchorTokens(value).length;
}

export function artifactAnchorHasSpecificWords(value: string): boolean {
  return meaningfulTokenCount(anchorTokens(value)) >= 2;
}

/**
 * Chooses a short, contiguous phrase already present in an artifact. This is
 * used only to keep deterministic evaluation fixtures coherent; learners pick
 * their own phrase in the product UI.
 */
export function suggestArtifactAnchor(artifact: string): string {
  const tokens = anchorTokens(artifact);
  for (
    let windowLength = ARTIFACT_ANCHOR_MIN_WORDS;
    windowLength <= ARTIFACT_ANCHOR_MAX_WORDS;
    windowLength += 1
  ) {
    for (let start = 0; start + windowLength <= tokens.length; start += 1) {
      const candidate = tokens.slice(start, start + windowLength);
      const value = candidate.map(({ original }) => original).join(" ");
      if (
        value.length <= ARTIFACT_ANCHOR_MAX_CHARACTERS &&
        meaningfulTokenCount(candidate) >= 2
      ) {
        return value;
      }
    }
  }

  throw new Error(
    "The learner artifact needs a short phrase with at least two specific words.",
  );
}

/**
 * This is an inspectable continuity check, not semantic grading. The learner
 * chooses a short phrase from the design move and repeats it in the creation;
 * the app verifies only that exact normalized phrase bridge.
 */
export function validateEvidenceApplicationArtifact(
  evidenceApplication: EvidenceApplication,
  artifact: string,
): EvidenceApplicationArtifactValidation {
  const anchor = evidenceApplication.artifactAnchor?.trim();
  if (!anchor) {
    return {
      success: false,
      field: "artifactAnchor",
      message:
        "Add a 2–8 word creation anchor from your evidence-driven design move.",
    };
  }

  const phraseTokens = anchorTokens(anchor);
  if (
    phraseTokens.length < ARTIFACT_ANCHOR_MIN_WORDS ||
    phraseTokens.length > ARTIFACT_ANCHOR_MAX_WORDS ||
    meaningfulTokenCount(phraseTokens) < 2
  ) {
    return {
      success: false,
      field: "artifactAnchor",
      message:
        "Use a 2–8 word anchor with at least two specific words from your design move.",
    };
  }

  if (
    !containsTokenSequence(
      anchorTokens(evidenceApplication.designChoice),
      phraseTokens,
    )
  ) {
    return {
      success: false,
      field: "artifactAnchor",
      message:
        "Choose an anchor phrase that appears exactly in your evidence-driven design move.",
    };
  }

  if (!containsTokenSequence(anchorTokens(artifact), phraseTokens)) {
    return {
      success: false,
      field: "artifact",
      message:
        "Repeat that exact creation anchor in your response so the evidence-to-design bridge is visible.",
    };
  }

  return { success: true };
}
