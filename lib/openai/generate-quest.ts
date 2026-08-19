import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { questPlanSchema } from "@/lib/schemas";
import {
  questTimeBudgetFor,
  questWorkloadLimitsFor,
} from "@/lib/quest-time-budget";
import {
  assertBrowserSafeActivity,
  assertSafetyIdentifier,
} from "@/lib/safety";
import type { QuestPlan, QuestRequest } from "@/types/curiosity";

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
import { buildQuestPrompt, REASONWEAVE_SYSTEM_PROMPT } from "./prompts";

const MODEL_QUEST_LIMITS = {
  drivingQuestion: 220,
  predictionPrompt: 320,
  investigationPrompt: 320,
  creationChallenge: 600,
  safetyNote: 220,
  hint: 240,
} as const;

function modelQuestSchemaFor(durationMinutes: QuestRequest["durationMinutes"]) {
  const workload = questWorkloadLimitsFor(durationMinutes);
  return z.object({
    drivingQuestion: z.string().min(12).max(MODEL_QUEST_LIMITS.drivingQuestion),
    predictionPrompt: z
      .string()
      .min(20)
      .max(MODEL_QUEST_LIMITS.predictionPrompt),
    investigationPrompt: z
      .string()
      .min(20)
      .max(MODEL_QUEST_LIMITS.investigationPrompt),
    creationChallenge: z
      .string()
      .min(30)
      .max(MODEL_QUEST_LIMITS.creationChallenge),
    constraints: z
      .array(z.string().min(4).max(180))
      .min(workload.constraints.min)
      .max(workload.constraints.max),
    completionCriteria: z
      .array(z.string().min(4).max(180))
      .min(workload.completionCriteria.min)
      .max(workload.completionCriteria.max),
    safetyNote: z.string().min(10).max(MODEL_QUEST_LIMITS.safetyNote),
    hint: z.string().min(10).max(MODEL_QUEST_LIMITS.hint),
  });
}

export async function generateQuest(
  input: QuestRequest,
  signal?: AbortSignal,
): Promise<QuestPlan> {
  assertSafetyIdentifier(input.safetyIdentifier);

  return withModelOutputRetry(async () => {
    const response = await getOpenAIClient().responses.parse(
      {
        model: getOpenAIModel(),
        instructions: REASONWEAVE_SYSTEM_PROMPT,
        input: buildQuestPrompt(input),
        text: {
          ...responseTextDefaults,
          format: zodTextFormat(
            modelQuestSchemaFor(input.durationMinutes),
            "wonderlab_quest",
          ),
        },
        max_output_tokens: 1_800,
        safety_identifier: input.safetyIdentifier,
        ...responseDefaults,
      },
      { signal },
    );

    const parsed = requireParsedOutput(response);
    assertModelProseComplete([
      {
        value: parsed.drivingQuestion,
        maxLength: MODEL_QUEST_LIMITS.drivingQuestion,
      },
      {
        value: parsed.predictionPrompt,
        maxLength: MODEL_QUEST_LIMITS.predictionPrompt,
      },
      {
        value: parsed.investigationPrompt,
        maxLength: MODEL_QUEST_LIMITS.investigationPrompt,
      },
      {
        value: parsed.creationChallenge,
        maxLength: MODEL_QUEST_LIMITS.creationChallenge,
      },
      {
        value: parsed.safetyNote,
        maxLength: MODEL_QUEST_LIMITS.safetyNote,
      },
      { value: parsed.hint, maxLength: MODEL_QUEST_LIMITS.hint },
    ]);
    const quest = parseModelResult(questPlanSchema, {
      routeId: input.selectedRoute.id,
      timeBudget: questTimeBudgetFor(input.durationMinutes),
      ...parsed,
    });

    assertBrowserSafeActivity([
      quest.drivingQuestion,
      quest.predictionPrompt,
      quest.investigationPrompt,
      quest.creationChallenge,
      ...quest.constraints,
      ...quest.completionCriteria,
      quest.hint,
      quest.safetyNote,
    ]);

    return quest;
  }, signal);
}
