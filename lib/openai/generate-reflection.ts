import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { evidenceDecisionNarrative } from "@/lib/evidence-decision";
import { reflectRequestSchema, reflectionResultSchema } from "@/lib/schemas";
import {
  assertEvidenceDecisionGrounding,
  assertReflectionQuality,
} from "@/lib/reflection-quality";
import {
  assertBrowserSafeActivity,
  assertNoLearnerProfiling,
  assertSafetyIdentifier,
} from "@/lib/safety";
import type {
  ReflectRequest,
  ReflectionResult,
  SemanticMapDelta,
} from "@/types/curiosity";

import {
  assertModelProseComplete,
  getOpenAIClient,
  getOpenAIModel,
  parseModelResult,
  requireParsedOutput,
  responseDefaults,
  responseTextDefaults,
  withModelOutputRetry,
} from "./client";
import { buildReflectionPrompt, REASONWEAVE_SYSTEM_PROMPT } from "./prompts";

const MODEL_REFLECTION_LIMITS = {
  specificFeedback: 700,
  discoverySummary: 600,
  changedThinking: 500,
  keyTradeoff: 300,
} as const;

const modelReflectionSchema = z.object({
  specificFeedback: z
    .string()
    .min(30)
    .max(MODEL_REFLECTION_LIMITS.specificFeedback),
  discoverySummary: z
    .string()
    .min(20)
    .max(MODEL_REFLECTION_LIMITS.discoverySummary),
  changedThinking: z
    .string()
    .min(20)
    .max(MODEL_REFLECTION_LIMITS.changedThinking),
  keyTradeoff: z
    .string()
    .min(8)
    .max(MODEL_REFLECTION_LIMITS.keyTradeoff)
    .nullable(),
  newQuestions: z.array(z.string().min(12).max(220)).length(3),
});

function mapLabel(value: string, maxLength = 96): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function mapDetail(value: string): string {
  return mapLabel(value, 360);
}

function buildMapDeltas(
  changedThinking: string,
  newQuestions: readonly string[],
): SemanticMapDelta[] {
  return [
    {
      nodeId: "reflection",
      kind: "reflection",
      label: mapLabel(changedThinking),
      detail: mapDetail(changedThinking),
      parentNodeId: "creation",
    },
    ...newQuestions.map((question, index) => ({
      nodeId: `next-${index + 1}`,
      kind: "next_question" as const,
      label: mapLabel(question),
      detail: mapDetail(question),
      parentNodeId: "reflection",
    })),
  ];
}

function reflectionPromptWithEvidenceDecision(input: ReflectRequest): string {
  const decision = input.evidenceDecision;
  const selectedEvidence = input.evidence.items.find(
    (item) => item.id === decision.evidenceItemId,
  );
  if (!selectedEvidence) {
    throw new Error(
      "The reflection request is missing the selected evidence finding.",
    );
  }
  const selectedSources = selectedEvidence.sourceIds
    .map((sourceId) =>
      input.evidence.sources.find((source) => source.id === sourceId),
    )
    .filter((source) => source !== undefined)
    .map((source) => `${source.title} (${source.domain})`);

  return buildReflectionPrompt({
    question: input.question,
    route: input.route,
    prediction: input.prediction,
    evidenceRelationship: decision.relationship,
    evidenceSummary: [
      input.evidence.conciseExplanation,
      "",
      "Learner evidence decision:",
      `- Selected finding: ${selectedEvidence.statement}`,
      `- Selected sources: ${selectedSources.join(", ")}`,
      `- Relationship to the initial prediction: ${decision.relationship}`,
      `- What the cited sources establish: ${decision.establishes}`,
      `- What remains unresolved: ${decision.unresolved}`,
      `- Why that boundary matters for the prediction: ${decision.impact}`,
      `- Learner's evidence-to-design link: ${input.evidenceApplication.designChoice}`,
    ].join("\n"),
    artifact: input.artifact,
    reflection: input.reflection,
  });
}

export async function generateReflection(
  input: ReflectRequest,
  signal?: AbortSignal,
): Promise<ReflectionResult> {
  const validatedInput = reflectRequestSchema.parse(input);
  assertSafetyIdentifier(validatedInput.safetyIdentifier);
  const selectedEvidence = validatedInput.evidence.items.find(
    (item) => item.id === validatedInput.evidenceDecision.evidenceItemId,
  );
  if (!selectedEvidence) {
    throw new Error(
      "The validated reflection request is missing its selected evidence finding.",
    );
  }

  return withModelOutputRetry(async () => {
    const response = await getOpenAIClient().responses.parse(
      {
        model: getOpenAIModel(),
        instructions: REASONWEAVE_SYSTEM_PROMPT,
        input: reflectionPromptWithEvidenceDecision(validatedInput),
        text: {
          ...responseTextDefaults,
          format: zodTextFormat(modelReflectionSchema, "wonderlab_reflection"),
        },
        max_output_tokens: 2_000,
        safety_identifier: validatedInput.safetyIdentifier,
        ...responseDefaults,
      },
      { signal },
    );

    const parsed = requireParsedOutput(response);
    assertModelProseComplete([
      {
        value: parsed.specificFeedback,
        maxLength: MODEL_REFLECTION_LIMITS.specificFeedback,
      },
      {
        value: parsed.discoverySummary,
        maxLength: MODEL_REFLECTION_LIMITS.discoverySummary,
      },
      {
        value: parsed.changedThinking,
        maxLength: MODEL_REFLECTION_LIMITS.changedThinking,
      },
      ...(parsed.keyTradeoff
        ? [
            {
              value: parsed.keyTradeoff,
              maxLength: MODEL_REFLECTION_LIMITS.keyTradeoff,
            },
          ]
        : []),
    ]);
    assertNoLearnerProfiling([
      parsed.specificFeedback,
      parsed.discoverySummary,
      parsed.changedThinking,
      parsed.keyTradeoff ?? "",
      ...parsed.newQuestions,
    ]);
    assertBrowserSafeActivity([
      parsed.specificFeedback,
      parsed.discoverySummary,
      parsed.changedThinking,
      parsed.keyTradeoff ?? "",
      ...parsed.newQuestions,
    ]);
    assertReflectionQuality(parsed, [
      validatedInput.prediction,
      evidenceDecisionNarrative(validatedInput.evidenceDecision),
      validatedInput.evidenceApplication.designChoice,
      validatedInput.artifact,
      validatedInput.reflection.usedToThink,
      validatedInput.reflection.nowThink,
      validatedInput.reflection.stillWonder,
    ]);
    assertEvidenceDecisionGrounding(parsed, {
      relationship: validatedInput.evidenceDecision.relationship,
      reason: evidenceDecisionNarrative(validatedInput.evidenceDecision),
      selectedFinding: selectedEvidence.statement,
      designChoice: validatedInput.evidenceApplication.designChoice,
    });

    return parseModelResult(reflectionResultSchema, {
      specificFeedback: parsed.specificFeedback,
      discoverySummary: parsed.discoverySummary,
      changedThinking: parsed.changedThinking,
      ...(parsed.keyTradeoff ? { keyTradeoff: parsed.keyTradeoff } : {}),
      newQuestions: parsed.newQuestions,
      mapDeltas: buildMapDeltas(parsed.changedThinking, parsed.newQuestions),
    });
  }, signal);
}
