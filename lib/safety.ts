import { ApiError } from "@/lib/api-errors";

export const SAFETY_DISCLOSURE =
  "ReasonWeave uses AI and web sources to guide an investigation. AI can make mistakes. Check cited sources and involve a qualified adult for health, safety, or physical activities.";

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const DEFAULT_IGNORABLE_PATTERN = /\p{Default_Ignorable_Code_Point}/gu;

/** Canonicalizes text before any rendered-content policy comparison. */
export function canonicalizePolicyText(parts: readonly string[]): string {
  return parts
    .map((part) =>
      part
        .normalize("NFKC")
        .replace(DEFAULT_IGNORABLE_PATTERN, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join(" ");
}

const UNSAFE_ACTIVITY_RULES: ReadonlyArray<{
  id: string;
  pattern: RegExp;
}> = [
  {
    id: "chemicals",
    pattern:
      /\b(?:mix|combine|heat|burn|ignite|boil|taste|inhale|sniff|handle|pour)\b.{0,70}\b(?:bleach|ammonia|acid|peroxide|solvent|fuel|chemical|cleaner|powder|liquid|substance)s?\b/i,
  },
  {
    id: "fire-or-heat",
    pattern:
      /\b(?:light|start|build|make|touch|hold|handle)\b.{0,55}\b(?:fire|open flame|burner|hot plate|stove|boiling water)\b/i,
  },
  {
    id: "fire-or-heat",
    pattern:
      /\b(?:boil|heat)\s+(?:(?:the|some|a)\s+)?(?:water|liquid|food|metal|glass|container)\b/i,
  },
  {
    id: "electricity",
    pattern:
      /\b(?:build|assemble|wire|repair|open|test|connect|attach|strip|splice|plug)\b.{0,70}\b(?:circuit|outlet|battery pack|mains electricity|high voltage|live wire|electrical panel)s?\b/i,
  },
  {
    id: "pressure-vessel",
    pattern:
      /\b(?:build|assemble|open|pressurize|repair|test|use)\b.{0,70}\b(?:pressure vessel|pressurized tank|compressed[- ]gas cylinder)s?\b/i,
  },
  {
    id: "weapons-or-sharp-tools",
    pattern:
      /\b(?:build|make|use|using|handle|sharpen|throw|fire)\b.{0,55}\b(?:weapon|firearm|gun|knife|blade|explosive)s?\b/i,
  },
  {
    id: "ingestion-or-inhalation",
    pattern:
      /\b(?:taste|eat|drink|swallow|ingest|inhale|sniff)\b.{0,60}\b(?:sample|substance|chemical|plant|medicine|compound|unknown liquid|mushroom)s?\b/i,
  },
  {
    id: "bodily-experiment",
    pattern:
      /\b(?:hold (?:your|one['’]s) breath|hyperventilate|stay awake|skip sleep|fast|stop eating|restrict food|induce pain|expose yourself|test on your body|test on yourself)\b/i,
  },
  {
    id: "dangerous-water-activity",
    pattern:
      /\b(?:dive|swim|submerge yourself|hold (?:your|one['’]s) breath)\b.{0,55}\b(?:underwater|deep water|ocean|river|lake|dangerous depth)\b/i,
  },
  {
    id: "dangerous-location",
    pattern:
      /\b(?:visit|go to|enter|explore|climb|approach)\b.{0,65}\b(?:cliff edge|roof|abandoned building|construction site|cave|confined space|traffic|railroad tracks|storm drain|dangerous location)s?\b/i,
  },
  {
    id: "illegal-activity",
    pattern:
      /\b(?:break in|trespass|steal|hack into|evade law enforcement|bypass a lock|pick a lock)\b/i,
  },
  {
    id: "animal-or-ecosystem-harm",
    pattern:
      /\b(?:dissect|cut open|injure|harm|trap|capture|poison|kill|handle)\b.{0,55}\b(?:animal|wildlife|frog|fish|bird|insect|ecosystem)s?\b/i,
  },
];

const DIRECT_NEGATION_PATTERN =
  /\b(?:do not|don't|never|avoid|must not|should not|should never)(?:\s+(?:ever|physically|personally|actually))?(?:\s+(?:attempt|try)\s+to)?\s*$/i;

const VIRTUAL_ACTIVITY_PATTERN =
  /\b(?:(?:browser(?:-based)?|computer|digital|virtual)\s+(?:diagram|model|simulation)|(?:causal|conceptual|systems?)\s+(?:diagram|model|simulation)|published data|source data)\b/i;

const PHYSICAL_FOLLOW_THROUGH_PATTERN =
  /\b(?:then|next|afterwards?|subsequently|how to|instructions? to|steps? to)\b.{0,28}\b(?:build|make|use|handle|test|visit|enter|mix|heat|ignite|boil|wire|connect|taste|eat|drink|inhale|dive|climb|dissect)\b/i;

function isNegatedInstruction(text: string, matchIndex: number): boolean {
  const prefix = text.slice(Math.max(0, matchIndex - 80), matchIndex);
  return DIRECT_NEGATION_PATTERN.test(prefix);
}

function isClearlyVirtualActivity(matchText: string): boolean {
  return (
    VIRTUAL_ACTIVITY_PATTERN.test(matchText) &&
    !PHYSICAL_FOLLOW_THROUGH_PATTERN.test(matchText)
  );
}

const DIAGNOSIS_REFERENCE_PATTERN = /\bdiagnos(?:e|es|ed|is|ing)\b/gi;
const ANTI_DIAGNOSIS_PREFIX =
  /(?:\bwithout|\bavoid(?:s|ed|ing)?|\bnot|\bnever)(?:\s+[a-z]+(?:-[a-z]+)?){0,5}\s+(?:as\s+)?(?:an?\s+)?$/i;

function hasUnnegatedDiagnosisReference(text: string): boolean {
  const matcher = new RegExp(DIAGNOSIS_REFERENCE_PATTERN.source, "gi");
  for (const match of text.matchAll(matcher)) {
    const prefix = text
      .slice(0, match.index ?? 0)
      .split(/[.!?;]/)
      .at(-1)
      ?.slice(-80);
    if (!prefix || !ANTI_DIAGNOSIS_PREFIX.test(prefix)) return true;
  }
  return false;
}

export function unsafeActivityReasons(parts: readonly string[]): string[] {
  const reasons = new Set<string>();
  const normalizedParts = parts.map((part) => canonicalizePolicyText([part]));
  const combinedText = normalizedParts.filter(Boolean).join(" ");
  const activityText = [...normalizedParts, combinedText];

  for (const part of activityText) {
    for (const rule of UNSAFE_ACTIVITY_RULES) {
      const matcher = new RegExp(
        rule.pattern.source,
        rule.pattern.flags.includes("g")
          ? rule.pattern.flags
          : `${rule.pattern.flags}g`,
      );
      for (const match of part.matchAll(matcher)) {
        if (
          !isNegatedInstruction(part, match.index ?? 0) &&
          !isClearlyVirtualActivity(match[0])
        ) {
          reasons.add(rule.id);
        }
      }
    }
  }

  return [...reasons];
}

export function assertSafetyIdentifier(value: string): void {
  if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
    throw new ApiError({
      code: "INVALID_REQUEST",
      message:
        "The anonymous session identifier is invalid. Clear the session and try again.",
      status: 400,
    });
  }
}

export function assertBrowserSafeActivity(parts: readonly string[]): void {
  if (unsafeActivityReasons(parts).length > 0) {
    throw new ApiError({
      code: "UNSAFE_ACTIVITY",
      message:
        "The generated activity did not pass ReasonWeave's browser-safety check. Try again or use the demo quest.",
      status: 502,
      retryable: true,
    });
  }
}

export function assertNoLearnerProfiling(parts: readonly string[]): void {
  const text = canonicalizePolicyText(parts);
  const prohibitedPatterns = [
    /\byour (?:grade|score) is\b/i,
    /\byou (?:are|have|seem) (?:adhd|autistic|dyslexic|gifted)\b/i,
    /\byou (?:are|seem) (?:a |an )?(?:visual|auditory|kinesthetic) learner\b/i,
    /\byou (?:have|show signs of) (?:adhd|autism|dyslexia|a disability|a disorder)\b/i,
    /\byour (?:intelligence|iq|personality)\b/i,
    /\b(?:great|excellent|amazing|good) job\b/i,
    /\byou (?:are|must be) (?:smart|gifted|brilliant|a genius)\b/i,
    /\b(?:you learned best|your learning style)\b/i,
    /\b(?:reasonweave|wonderlab|this activity|this quest|the activity|the quest)\b.{0,30}\b(?:will|can|is proven to|guarantees?|improves?|increases?|boosts?|enhances?)\b.{0,60}\b(?:grades?|learning|retention|curiosity|achievement|educational outcomes?)\b/i,
  ];

  if (
    hasUnnegatedDiagnosisReference(text) ||
    prohibitedPatterns.some((pattern) => pattern.test(text))
  ) {
    throw new ApiError({
      code: "INVALID_MODEL_RESPONSE",
      message:
        "The live feedback did not meet ReasonWeave's learner-agency rules. Try again or use the demo quest.",
      status: 502,
      retryable: true,
    });
  }
}
