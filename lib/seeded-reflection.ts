import seededDemoJson from "@/data/demo-underwater.json";
import { seededDemoSessionSchema } from "@/lib/schemas";
import type {
  EvidenceBundle,
  EvidenceApplication,
  EvidenceDecision,
  ExplorationRoute,
  ReflectionInput,
  ReflectionResult,
} from "@/types/curiosity";

const SEEDED_DEMO = seededDemoSessionSchema.parse(seededDemoJson);
const TERMINAL_PUNCTUATION = /[.!?…]$/;

function clip(value: string, maximum: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function naturalSentence(value: string, maximum: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const sentenceEnd = [...normalized.matchAll(/[.!?…](?=\s|$)/g)].find(
    (match) => (match.index ?? maximum) < maximum,
  );
  const firstSentence = sentenceEnd
    ? normalized.slice(0, (sentenceEnd.index ?? 0) + sentenceEnd[0].length)
    : normalized;

  if (firstSentence.length <= maximum) {
    return TERMINAL_PUNCTUATION.test(firstSentence)
      ? firstSentence
      : `${firstSentence}.`;
  }

  const bounded = firstSentence.slice(0, maximum);
  const clauseEnd = Math.max(
    bounded.lastIndexOf(","),
    bounded.lastIndexOf(";"),
    bounded.lastIndexOf(":"),
  );
  const wordEnd = bounded.lastIndexOf(" ");
  const end = clauseEnd >= Math.floor(maximum * 0.55) ? clauseEnd : wordEnd;
  const readable = bounded
    .slice(0, Math.max(end, 1))
    .trimEnd()
    .replace(/[,;:]$/, "")
    .replace(
      /\s+(?:a|an|the|and|or|but|because|that|which|who|with|without|for|to|of|in|on|at|from|by|as|while|if|than)$/i,
      "",
    );
  return `${readable}.`;
}

function naturalClause(value: string, maximum: number): string {
  const sentence = naturalSentence(value, maximum).replace(/[.!?…]+$/, "");
  const unframed = sentence
    .replace(/^because\s+/i, "")
    .replace(/^it\s+(?:shows|suggests|indicates)\s+(?:that\s+)?/i, "")
    .replace(
      /^(?:now\s+)?i\s+(?:think|believe|see|realize|understand)\s+(?:that\s+)?/i,
      "",
    )
    .replace(
      /^i\s+(?:used to think|thought|believed|assumed)\s+(?:that\s+)?/i,
      "",
    )
    .trim();
  const clause = unframed || sentence;
  if (/^[A-Z]{2}/.test(clause)) return clause;
  return `${clause.charAt(0).toLocaleLowerCase()}${clause.slice(1)}`;
}

function naturalWonderClause(value: string, maximum: number): string {
  const unframed = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^i\s+still\s+wonder\s+/i, "");
  return naturalClause(unframed, maximum);
}

function seededKeyTradeoff(route: ExplorationRoute): string {
  if (route.lens === "challenge") {
    return "Stricter ecosystem safeguards protect the ocean, but they can reduce where, when, and how much a habitat can operate.";
  }
  if (route.lens === "understand") {
    return "Greater depth can reduce surface disruption, but it increases pressure, repair difficulty, and emergency-response time.";
  }
  return "More surface access reduces isolation and repair risk, but it limits self-sufficiency and adds dependence on external infrastructure.";
}

function seededNextQuestions(
  route: ExplorationRoute,
): [string, string, string] {
  if (route.lens === "challenge") {
    return [
      "Which ecosystem signals should force an underwater habitat to stop operating?",
      "Who should decide whether the habitat's benefits justify its ocean impacts?",
      "How could designers test ecological safeguards before building a permanent settlement?",
    ];
  }
  if (route.lens === "understand") {
    return [
      "What depth best balances pressure, storms, surface traffic, and emergency access?",
      "Which single failure could trigger the longest chain of problems inside the habitat?",
      "How could a small prototype test that causal model without putting people at risk?",
    ];
  }
  return (
    SEEDED_DEMO.reflectionResult?.newQuestions ?? [
      "What depth best balances pressure with safe access?",
      "How much food could residents grow within the habitat's energy budget?",
      "Which ecosystem signals should force the habitat to stop operating?",
    ]
  );
}

export function buildSeededReflection(
  route: ExplorationRoute,
  reflection: ReflectionInput,
  artifact: string,
  evidence: EvidenceBundle,
  evidenceDecision: EvidenceDecision,
  evidenceApplication: EvidenceApplication,
): ReflectionResult {
  const questions = seededNextQuestions(route);
  const selectedEvidence = evidence.items.find(
    (item) => item.id === evidenceDecision.evidenceItemId,
  );
  const relationship = {
    supports: "supports",
    challenges: "challenges",
    complicates: "complicates",
  }[evidenceDecision.relationship];
  const finding = naturalSentence(
    selectedEvidence?.statement ?? evidence.conciseExplanation,
    170,
  );
  const now = naturalClause(reflection.nowThink, 190);
  const before = naturalClause(reflection.usedToThink, 190);
  const stillWonder = naturalWonderClause(reflection.stillWonder, 120);
  const completeFeedback = [
    `Your evidence judgment (${relationship}): ${naturalSentence(evidenceDecision.impact, 150)}`,
    `Evidence used: ${finding}`,
    `Still unresolved: ${naturalSentence(evidenceDecision.unresolved, 130)}`,
    `Evidence-to-design link: ${naturalSentence(evidenceApplication.designChoice, 150)}`,
    `Your creation: ${naturalSentence(artifact, 130)}`,
    `Still wondering: ${stillWonder}.`,
  ].join(" ");
  const boundedFeedback = [
    `Your evidence judgment (${relationship}): ${naturalSentence(evidenceDecision.impact, 100)}`,
    `Evidence used: ${naturalSentence(selectedEvidence?.statement ?? evidence.conciseExplanation, 100)}`,
    `Still unresolved: ${naturalSentence(evidenceDecision.unresolved, 80)}`,
    `Evidence-to-design link: ${naturalSentence(evidenceApplication.designChoice, 115)}`,
    `Your creation: ${naturalSentence(artifact, 105)}`,
    `Still wondering: ${naturalWonderClause(reflection.stillWonder, 80)}.`,
  ].join(" ");
  const specificFeedback =
    completeFeedback.length <= 800
      ? completeFeedback
      : clip(boundedFeedback, 800);

  return {
    specificFeedback,
    discoverySummary:
      "A viable underwater habitat is not one solved engineering problem; it is a connected system of structure, life support, logistics, maintenance, and ecosystem limits.",
    changedThinking: `At first, you thought ${before}. After investigating, you concluded ${now}.`,
    keyTradeoff: seededKeyTradeoff(route),
    newQuestions: questions,
    mapDeltas: [
      {
        nodeId: "reflection",
        kind: "reflection",
        label: "Changed model",
        detail: clip(reflection.nowThink, 330),
        parentNodeId: "creation",
      },
      ...questions.map((question, index) => ({
        nodeId: `next-question-${index + 1}`,
        kind: "next_question" as const,
        label: clip(question, 115),
        parentNodeId: "reflection",
      })),
    ],
  };
}
