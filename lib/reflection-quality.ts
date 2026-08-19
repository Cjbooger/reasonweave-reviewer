import { ApiError } from "@/lib/api-errors";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "could",
  "every",
  "from",
  "have",
  "into",
  "might",
  "more",
  "only",
  "rather",
  "still",
  "than",
  "that",
  "their",
  "there",
  "these",
  "they",
  "think",
  "this",
  "through",
  "used",
  "very",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
  "your",
]);

interface ReflectionQualityOutput {
  specificFeedback: string;
  changedThinking: string;
  newQuestions: readonly string[];
}

interface EvidenceDecisionQualityOutput extends ReflectionQualityOutput {
  discoverySummary?: string;
  keyTradeoff?: string | null;
}

interface EvidenceDecisionQualityContext {
  relationship: "supports" | "challenges" | "complicates";
  reason: string;
  selectedFinding: string;
  designChoice: string;
}

type EvidenceRelationship = EvidenceDecisionQualityContext["relationship"];

const RELATIONSHIP_FORMS: Record<EvidenceRelationship, string> = {
  supports: "support(?:s|ed|ing)?",
  challenges: "challeng(?:e|es|ed|ing)",
  complicates: "complicat(?:e|es|ed|ing)",
};

const RELATIONSHIP_NEGATION_PREFIX_PATTERN =
  /(?:\b(?:do|does|did|is|are|was|were|will|would|can|could|should|must|may|might)\s+not|\b(?:don't|doesn't|didn't|isn't|aren't|wasn't|weren't|won't|wouldn't|can't|couldn't|shouldn't|mustn't)\b|\bcannot\b|\bnever\b|\bno\s+longer\b|\bfail(?:s|ed|ing)?\s+to\b)(?:\s+[a-z]+(?:-[a-z]+)?){0,4}\s*$/i;

const TIED_RELATIONSHIP_ATTRIBUTION_PATTERN =
  /\b(?:you|learner)\b(?:(?![.!?;]).){0,35}\b(?:mark(?:ed|ing)?|cho(?:ose|se|sen)|select(?:ed|ing)?|record(?:ed|ing)?|label(?:ed|ing)?|describ(?:e|ed|ing)|classif(?:y|ied|ying)|fram(?:e|ed|ing)|identif(?:y|ied|ying)|treat(?:ed|ing)?|view(?:ed|ing)?|decid(?:e|ed|ing)|reason(?:ed|ing)?|judg(?:e|ed|ing)|us(?:e|ed|ing)|say|says|said)\b(?:(?!\b(?:and|artifact|but|design|however|question|route)\b|[,.;]).){0,70}\b(?:boundary|choice|decision|evidence|finding|it|judgment|reason|relationship|source|that|this)\b(?:(?![.!?;]).){0,35}$/i;

const DIRECT_RELATIONSHIP_LABEL_ATTRIBUTION_PATTERN =
  /\b(?:you|(?:the\s+)?learner)\b(?:(?![.!?;,]).){0,24}\b(?:mark(?:ed|ing)?|cho(?:ose|oses|se|sen)|select(?:ed|ing)?|record(?:ed|ing)?|label(?:ed|ing)?|describ(?:e|ed|ing)|classif(?:y|ies|ied|ying)|fram(?:e|ed|ing)|identif(?:y|ies|ied|ying)|decid(?:e|ed|ing))\b\s*(?:(?:the\s+)?(?:choice|decision|judgment|label|relationship)\s*(?:as|:)?\s*)?["'“‘]?\s*$/i;

const OPPOSING_RELATIONSHIP_FORMS: Record<EvidenceRelationship, string | null> =
  {
    supports:
      "challeng(?:e|es|ed|ing)|contradict(?:s|ed|ing)?|undermin(?:e|es|ed|ing)|weaken(?:s|ed|ing)?|refut(?:e|es|ed|ing)|conflict(?:s|ed|ing)?\\s+with",
    challenges:
      "support(?:s|ed|ing)?|confirm(?:s|ed|ing)?|reinforc(?:e|es|ed|ing)|align(?:s|ed|ing)?\\s+with|back(?:s|ed|ing)?\\s+up",
    // Supporting or challenging one part can legitimately be what makes a
    // finding complicate a larger prediction, so neither is automatically the
    // opposite of a learner's `complicates` choice.
    complicates: null,
  };

const DIRECT_RELATIONSHIP_SUBJECT_PATTERN =
  /\b(?:boundary|choice|decision|evidence|finding|it|judgment|label|limitation|reason|relationship|result|source|that|this)\b/i;

const DIRECT_RELATIONSHIP_TARGET_PATTERN =
  /\b(?:(?:a|an|earlier|initial|my|original|our|pressure-first|the|their|this|your)\s+){0,5}(?:claim(?!\s+about\b)|hypothesis|idea|model|position|prediction)\b/i;

const CALIBRATED_MISMATCH_PATTERN =
  /(?:\b(?:choice|decision|label|reason|relationship)\b.{0,70}\b(?:better\s+(?:described|classified)|does\s+not\s+(?:fit|match)|may\s+(?:need|not\s+(?:fit|match))|might\s+not\s+(?:fit|match)|mismatch|not\s+necessarily|rather\s+than|reconsider(?:ation)?|revisit|tension)\b|\b(?:mismatch|reconsider(?:ation)?|revisit|tension)\b.{0,70}\b(?:choice|decision|label|reason|relationship|prediction)\b)/i;

const CALIBRATED_CONTRAST_PATTERN =
  /\b(?:although|but|however|nevertheless|still|yet|at\s+the\s+same\s+time)\b/i;

const CALIBRATED_MODAL_PREFIX_PATTERN =
  /\b(?:(?:appear(?:s|ed)?|seem(?:s|ed)?)\s+(?:not\s+)?to|(?:may|might|could)\b|(?:apparently|arguably|perhaps|possibly|potentially|likely)\b)(?:\s+[a-z]+(?:-[a-z]+)?){0,4}\s*$/i;

interface RelationshipUse {
  attributed: boolean;
  index: number;
  negated: boolean;
}

function clauseStart(value: string, index: number): number {
  return (
    Math.max(
      value.lastIndexOf(".", index - 1),
      value.lastIndexOf("!", index - 1),
      value.lastIndexOf("?", index - 1),
      value.lastIndexOf(";", index - 1),
    ) + 1
  );
}

function clauseEnd(value: string, index: number): number {
  const endings = [".", "!", "?", ";"]
    .map((separator) => value.indexOf(separator, index))
    .filter((ending) => ending >= 0);
  return endings.length > 0 ? Math.min(...endings) : value.length;
}

function directRelationshipUses(
  value: string,
  forms: string,
): RelationshipUse[] {
  const normalized = value.replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
  const matcher = new RegExp(`\\b(?:${forms})\\b`, "gi");

  return [...normalized.matchAll(matcher)].flatMap((match) => {
    const index = match.index ?? 0;
    const prefix = normalized.slice(clauseStart(normalized, index), index);
    const suffix = normalized.slice(
      index + match[0].length,
      clauseEnd(normalized, index + match[0].length),
    );
    const nearbyPrefix = prefix.slice(-110);
    const nearbySuffix = suffix.slice(0, 100);
    const activeClaim =
      DIRECT_RELATIONSHIP_SUBJECT_PATTERN.test(nearbyPrefix) &&
      DIRECT_RELATIONSHIP_TARGET_PATTERN.test(nearbySuffix);
    const passiveClaim =
      DIRECT_RELATIONSHIP_TARGET_PATTERN.test(nearbyPrefix) &&
      /\b(?:is|are|was|were|be|been|being)\b/i.test(nearbyPrefix.slice(-45));
    const targetedModalClaim =
      DIRECT_RELATIONSHIP_TARGET_PATTERN.test(nearbySuffix) &&
      CALIBRATED_MODAL_PREFIX_PATTERN.test(nearbyPrefix.slice(-80));
    const targetedNegatedClaim =
      DIRECT_RELATIONSHIP_TARGET_PATTERN.test(nearbySuffix) &&
      RELATIONSHIP_NEGATION_PREFIX_PATTERN.test(nearbyPrefix);
    const attributedActorAction =
      TIED_RELATIONSHIP_ATTRIBUTION_PATTERN.test(nearbyPrefix);
    const attributedDirectLabel =
      DIRECT_RELATIONSHIP_LABEL_ATTRIBUTION_PATTERN.test(nearbyPrefix);
    const attributedOwnedDecision =
      /\b(?:your|learner's)\s+(?:evidence\s+)?(?:choice|decision|judgment|reason|relationship)\b/i.test(
        nearbyPrefix,
      );
    const attributedRecordedDecision =
      /\b(?:learner-authored|learner-recorded|recorded\s+learner)\s+(?:choice|decision|judgment|relationship)\b/i.test(
        nearbyPrefix,
      );
    const attributionIsTied =
      attributedActorAction ||
      attributedDirectLabel ||
      attributedOwnedDecision ||
      attributedRecordedDecision;
    const labelClaim =
      attributedDirectLabel ||
      (attributionIsTied &&
        /\b(?:as|choice|label|relationship)\s*["'“‘]?\s*$/i.test(nearbyPrefix));

    if (
      !activeClaim &&
      !passiveClaim &&
      !targetedModalClaim &&
      !targetedNegatedClaim &&
      !labelClaim
    ) {
      return [];
    }

    const directLabelNegated =
      attributedDirectLabel &&
      RELATIONSHIP_NEGATION_PREFIX_PATTERN.test(
        nearbyPrefix.replace(/["'“‘]\s*$/, ""),
      );
    const negated =
      (activeClaim || passiveClaim || targetedNegatedClaim) &&
      RELATIONSHIP_NEGATION_PREFIX_PATTERN.test(nearbyPrefix);

    return [
      {
        attributed: attributionIsTied && !negated && !directLabelNegated,
        index,
        negated: negated || directLabelNegated,
      },
    ];
  });
}

function usesAttributedRelationship(
  value: string,
  relationship: EvidenceRelationship,
): boolean {
  return directRelationshipUses(value, RELATIONSHIP_FORMS[relationship]).some(
    (use) => use.attributed && !use.negated,
  );
}

function usesNegatedRelationship(
  value: string,
  relationship: EvidenceRelationship,
): boolean {
  return directRelationshipUses(value, RELATIONSHIP_FORMS[relationship]).some(
    (use) => use.negated,
  );
}

function usesOpposingRelationship(
  value: string,
  relationship: EvidenceRelationship,
): boolean {
  const forms = OPPOSING_RELATIONSHIP_FORMS[relationship];
  return Boolean(
    forms && directRelationshipUses(value, forms).some((use) => !use.negated),
  );
}

function hasClearLearnerDecisionConflict(
  context: EvidenceDecisionQualityContext,
): boolean {
  return (
    usesNegatedRelationship(context.reason, context.relationship) ||
    usesOpposingRelationship(context.reason, context.relationship)
  );
}

function usesCalibratedRelationshipCorrection(
  value: string,
  relationship: EvidenceRelationship,
): boolean {
  const spans =
    value
      .replace(/[’]/g, "'")
      .replace(/[ \t]+/g, " ")
      .match(/[^.!?;\n]+(?:[.!?;]+|$)/g)
      ?.map((span) => span.trim())
      .filter(Boolean) ?? [];

  return spans.some((span) => {
    const selectedConflictUses = directRelationshipUses(
      span,
      RELATIONSHIP_FORMS[relationship],
    ).filter((use) => use.negated);
    const opposingForms = OPPOSING_RELATIONSHIP_FORMS[relationship];
    const opposingConflictUses = opposingForms
      ? directRelationshipUses(span, opposingForms).filter(
          (use) => !use.negated,
        )
      : [];
    const conflictUses = [...selectedConflictUses, ...opposingConflictUses];

    if (conflictUses.length === 0) return false;
    if (CALIBRATED_MISMATCH_PATTERN.test(span)) return true;

    return conflictUses.some((use) => {
      const prefix = span.slice(0, use.index);
      return (
        CALIBRATED_CONTRAST_PATTERN.test(prefix) ||
        CALIBRATED_MODAL_PREFIX_PATTERN.test(prefix.slice(-80))
      );
    });
  });
}

function meaningfulTokens(values: readonly string[]): Set<string> {
  return new Set(
    values
      .join(" ")
      .toLocaleLowerCase("en-US")
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.replace(/(?:ing|ed|es|s)$/i, ""))
      .filter((token) => token.length >= 5 && !STOP_WORDS.has(token)),
  );
}

function groundingCount(
  value: string,
  learnerTokens: ReadonlySet<string>,
): number {
  return [...meaningfulTokens([value])].filter((token) =>
    learnerTokens.has(token),
  ).length;
}

export function reflectionQualityIssues(
  output: ReflectionQualityOutput,
  learnerText: readonly string[],
): string[] {
  const issues: string[] = [];
  const learnerTokens = meaningfulTokens(learnerText);
  const feedbackGrounding = groundingCount(
    output.specificFeedback,
    learnerTokens,
  );
  const changedThinkingGrounding = groundingCount(
    output.changedThinking,
    learnerTokens,
  );

  if (feedbackGrounding < 2) {
    issues.push(
      "specific feedback must reuse at least two meaningful learner concepts",
    );
  }

  if (changedThinkingGrounding < 2) {
    issues.push(
      "changed-thinking synthesis must reuse at least two meaningful learner concepts",
    );
  }

  if (
    !/\b(?:before|became|changed|from|instead|now|once|previously|shift(?:ed|s)?|toward|used to|whereas)\b/i.test(
      output.changedThinking,
    )
  ) {
    issues.push("changed-thinking synthesis must make the shift explicit");
  }

  if (
    /^(?:great|good|nice|excellent|amazing)(?:\s+(?:job|work|thinking))?[!.\s]*$/i.test(
      output.specificFeedback.trim(),
    )
  ) {
    issues.push("feedback must not be generic praise");
  }

  if (!output.newQuestions.every((question) => question.trim().endsWith("?"))) {
    issues.push("every next question must use question form");
  }

  return issues;
}

export function assertReflectionQuality(
  output: ReflectionQualityOutput,
  learnerText: readonly string[],
): void {
  if (reflectionQualityIssues(output, learnerText).length === 0) return;

  throw new ApiError({
    code: "INVALID_MODEL_RESPONSE",
    message:
      "The live reflection did not meet ReasonWeave's learner-grounding rules. Try again or use the demo quest.",
    status: 502,
    retryable: true,
  });
}

export function evidenceDecisionGroundingIssues(
  output: EvidenceDecisionQualityOutput,
  context: EvidenceDecisionQualityContext,
): string[] {
  const issues: string[] = [];
  const responseText = [
    output.specificFeedback,
    output.discoverySummary ?? "",
    output.changedThinking,
    output.keyTradeoff ?? "",
  ].join("\n");
  const findingGrounding = groundingCount(
    responseText,
    meaningfulTokens([context.selectedFinding]),
  );
  const reasonGrounding = groundingCount(
    responseText,
    meaningfulTokens([context.reason]),
  );
  const designGrounding = groundingCount(
    responseText,
    meaningfulTokens([context.designChoice]),
  );
  const usesLearnerAttribution = usesAttributedRelationship(
    responseText,
    context.relationship,
  );
  const usesOpposingClaim = usesOpposingRelationship(
    responseText,
    context.relationship,
  );
  const usesSelectedNegation = usesNegatedRelationship(
    responseText,
    context.relationship,
  );
  const usesCalibratedCorrection = usesCalibratedRelationshipCorrection(
    responseText,
    context.relationship,
  );
  const clearLearnerDecisionConflict = hasClearLearnerDecisionConflict(context);

  if (!usesLearnerAttribution) {
    issues.push(
      `reflection must attribute the learner's recorded ${context.relationship} evidence relationship`,
    );
  }
  if (
    (usesOpposingClaim || usesSelectedNegation) &&
    (!usesLearnerAttribution || !usesCalibratedCorrection)
  ) {
    issues.push(
      "reflection must not silently rewrite the learner's evidence relationship; preserve the recorded choice before offering a calibrated correction",
    );
  }
  if (clearLearnerDecisionConflict && !usesCalibratedCorrection) {
    issues.push(
      "reflection must surface calibrated tension instead of unconditionally endorsing a learner reason that clearly conflicts with the recorded relationship",
    );
  }
  if (findingGrounding < 2) {
    issues.push(
      "reflection must reuse at least two meaningful concepts from the selected finding",
    );
  }
  if (reasonGrounding < 2) {
    issues.push(
      "reflection must reuse at least two meaningful concepts from the learner's evidence reason",
    );
  }
  if (designGrounding < 2) {
    issues.push(
      "reflection must reuse at least two meaningful concepts from the learner's evidence-to-design link",
    );
  }

  return issues;
}

export function assertEvidenceDecisionGrounding(
  output: EvidenceDecisionQualityOutput,
  context: EvidenceDecisionQualityContext,
): void {
  if (evidenceDecisionGroundingIssues(output, context).length === 0) return;

  throw new ApiError({
    code: "INVALID_MODEL_RESPONSE",
    message:
      "The live reflection did not respond closely enough to the learner's evidence decision. Try again or use the demo quest.",
    status: 502,
    retryable: true,
  });
}
