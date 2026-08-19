import { curiositySessionSchema } from "@/lib/schemas";
import { NEXT_QUESTION_IDS } from "@/types/curiosity";
import type {
  CuriositySession,
  EvidenceKind,
  EvidenceRelationship,
  LearnerLevel,
  SourceReference,
} from "@/types/curiosity";

const LEVEL_LABELS: Record<LearnerLevel, string> = {
  high_school: "High school",
  college: "College",
  curious_adult: "Curious adult",
};

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  evidence: "Evidence",
  inference: "Inference",
  open_question: "Open question",
};

const EVIDENCE_RELATIONSHIP_LABELS: Record<EvidenceRelationship, string> = {
  supports: "Supports the initial prediction",
  challenges: "Challenges the initial prediction",
  complicates: "Complicates the initial prediction",
};

function clean(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

/**
 * Neutralize raw HTML and active Markdown constructs in learner- and
 * model-authored text. Fixed ReasonWeave formatting and normalized source URLs
 * remain Markdown.
 */
function escapeMarkdownText(value: string): string {
  return clean(value)
    .split("\n")
    .map((line) => {
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/([\\`*_[\]{}()#!|~])/g, "\\$1");

      if (/^\s{0,3}(?:[-+]\s|\d+[.)]\s|[-=]{3,}\s*$)/.test(escaped)) {
        return escaped.replace(/^([\s\d]*)([-+.)=])/, "$1\\$2");
      }

      return escaped;
    })
    .join("\n");
}

function quote(value: string): string {
  return escapeMarkdownText(value)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function escapeLinkLabel(value: string): string {
  return escapeMarkdownText(value);
}

function sourceLink(source: SourceReference): string {
  const normalizedUrl = new URL(source.url).href.replace(/>/g, "%3E");
  return `[${escapeLinkLabel(source.title)}](<${normalizedUrl}>)`;
}

/**
 * Creates a shareable Learning Trace without session IDs, timestamps, hidden
 * prompts, safety identifiers, model metadata, or other private internals.
 */
export function exportSessionToMarkdown(session: CuriositySession): string {
  const parsed = curiositySessionSchema.parse(session);
  const route = parsed.routes.find(
    (candidate) => candidate.id === parsed.selectedRouteId,
  );

  if (
    parsed.step !== "branch" ||
    !route ||
    !parsed.quest ||
    !parsed.prediction ||
    !parsed.evidence ||
    !parsed.evidenceDecision ||
    !parsed.evidenceApplication ||
    !parsed.artifact ||
    !parsed.reflectionInput ||
    !parsed.reflectionResult ||
    !parsed.selectedNextQuestionId
  ) {
    throw new Error(
      "The Discovery Card is available after the quest and reflection are complete and a next question is chosen.",
    );
  }

  const selectedNextQuestionIndex = NEXT_QUESTION_IDS.indexOf(
    parsed.selectedNextQuestionId,
  );
  const selectedNextQuestion =
    parsed.reflectionResult.newQuestions[selectedNextQuestionIndex];

  const sourceById = new Map(
    parsed.evidence.sources.map((source) => [source.id, source]),
  );
  const evidenceDecision = parsed.evidenceDecision;
  const evidenceApplication = parsed.evidenceApplication;
  const selectedEvidence = parsed.evidence.items.find(
    (item) => item.id === evidenceDecision.evidenceItemId,
  );
  if (!selectedEvidence) {
    throw new Error(
      "The Discovery Card requires a valid learner evidence decision.",
    );
  }
  const decisionCitations = selectedEvidence.sourceIds
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is SourceReference => source !== undefined)
    .map(sourceLink);
  const lines: string[] = ["# ReasonWeave Learning Trace", ""];

  if (parsed.mode === "seeded_fallback" && parsed.seededDisclosure) {
    lines.push(
      `> **Pre-generated demo:** ${escapeMarkdownText(parsed.seededDisclosure)}`,
      "",
    );
  }

  lines.push(
    "## Starting question",
    "",
    quote(parsed.question),
    "",
    `**Level:** ${LEVEL_LABELS[parsed.level]}  `,
    `**Quest length:** ${parsed.durationMinutes} minutes`,
    "",
    "## Selected route",
    "",
    `**${escapeMarkdownText(route.title)}** — ${escapeMarkdownText(route.hook)}`,
    "",
    `Thinking lens: ${route.lens.replace("_", " ")} · Activity: ${escapeMarkdownText(route.activityType)}`,
    "",
    "## Initial prediction",
    "",
    quote(parsed.prediction),
    "",
    "## Evidence Lens",
    "",
  );

  parsed.evidence.items.forEach((item, index) => {
    const citations = item.sourceIds
      .map((sourceId) => sourceById.get(sourceId))
      .filter((source): source is SourceReference => source !== undefined)
      .map(sourceLink);
    const citationText =
      citations.length > 0 ? ` Sources: ${citations.join(", ")}.` : "";

    lines.push(
      `${index + 1}. **${EVIDENCE_LABELS[item.kind]}:** ${escapeMarkdownText(item.statement)}${citationText}`,
    );
  });

  lines.push(
    "",
    "### Sources",
    "",
    ...parsed.evidence.sources.map(
      (source) =>
        `- ${sourceLink(source)} — ${escapeMarkdownText(source.domain)}`,
    ),
    "",
    "## Learner evidence decision",
    "",
    `**Relationship:** ${EVIDENCE_RELATIONSHIP_LABELS[evidenceDecision.relationship]}`,
    "",
    `**Selected finding:** ${escapeMarkdownText(selectedEvidence.statement)}`,
    "",
    `**Citations:** ${decisionCitations.join(", ")}`,
    "",
    "**What the cited sources establish:**",
    "",
    quote(evidenceDecision.establishes),
    "",
    "**What the cited sources do not settle (source scope):**",
    "",
    quote(evidenceDecision.unresolved),
    "",
    "**Why that matters for the prediction:**",
    "",
    quote(evidenceDecision.impact),
    "",
    "## Evidence → design",
    "",
    `**Linked finding:** ${escapeMarkdownText(selectedEvidence.statement)}`,
    "",
    "**Learner design choice:**",
    "",
    quote(evidenceApplication.designChoice),
    "",
    ...(evidenceApplication.artifactAnchor
      ? [
          "**Creation anchor (exact learner-selected phrase repeated in the design move and creation):**",
          "",
          quote(evidenceApplication.artifactAnchor),
          "",
        ]
      : []),
    "## Creation",
    "",
    `**Challenge:** ${escapeMarkdownText(parsed.quest.creationChallenge)}`,
    "",
    "**Constraints:**",
    "",
    ...parsed.quest.constraints.map(
      (constraint) => `- ${escapeMarkdownText(constraint)}`,
    ),
    "",
    "**Completion criteria:**",
    "",
    ...parsed.quest.completionCriteria.map(
      (criterion) => `- ${escapeMarkdownText(criterion)}`,
    ),
    "",
    "**Learner artifact:**",
    "",
    quote(parsed.artifact),
    "",
    "## Reflection",
    "",
    `- **I used to think…** ${escapeMarkdownText(parsed.reflectionInput.usedToThink)}`,
    `- **Now I think…** ${escapeMarkdownText(parsed.reflectionInput.nowThink)}`,
    `- **I still wonder…** ${escapeMarkdownText(parsed.reflectionInput.stillWonder)}`,
    "",
    "## What changed",
    "",
    quote(parsed.reflectionResult.changedThinking),
  );

  if (parsed.reflectionResult.keyTradeoff) {
    lines.push(
      "",
      `**Key tradeoff:** ${escapeMarkdownText(parsed.reflectionResult.keyTradeoff)}`,
    );
  }

  lines.push(
    "",
    `**ReasonWeave feedback:** ${escapeMarkdownText(parsed.reflectionResult.specificFeedback)}`,
    "",
    "## My next question",
    "",
    quote(selectedNextQuestion),
    "",
    "## Three next questions",
    "",
    ...parsed.reflectionResult.newQuestions.map(
      (question, index) => `${index + 1}. ${escapeMarkdownText(question)}`,
    ),
    "",
    "## Discuss this trace",
    "",
    "What would make you revise that evidence decision or design choice?",
    "",
    "Optional discussion prompt—not a score or diagnosis.",
    "",
    "---",
    "",
    "Created with ReasonWeave. AI can make mistakes; check the cited sources.",
  );

  return `${lines.join("\n")}\n`;
}

export const buildDiscoveryMarkdown = exportSessionToMarkdown;
