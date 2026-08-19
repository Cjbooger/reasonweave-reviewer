import type { QuestDuration, QuestStep } from "@/types/curiosity";

export type TimedQuestStep = Exclude<QuestStep, "spark">;

export interface QuestTimeBudget {
  totalMinutes: QuestDuration;
  steps: Record<TimedQuestStep, number>;
}

export interface QuestWorkloadLimits {
  constraints: { min: number; max: number };
  completionCriteria: { min: number; max: number };
}

export const QUEST_TIME_BUDGETS = {
  5: {
    totalMinutes: 5,
    steps: {
      choose: 0.5,
      predict: 0.5,
      investigate: 1,
      create: 1.5,
      reflect: 1,
      branch: 0.5,
    },
  },
  10: {
    totalMinutes: 10,
    steps: {
      choose: 1,
      predict: 1,
      investigate: 2,
      create: 3,
      reflect: 2,
      branch: 1,
    },
  },
  15: {
    totalMinutes: 15,
    steps: {
      choose: 2,
      predict: 2,
      investigate: 3,
      create: 5,
      reflect: 2,
      branch: 1,
    },
  },
} as const satisfies Record<QuestDuration, QuestTimeBudget>;

const LEGACY_FIVE_MINUTE_STEPS = Object.freeze({
  choose: 1,
  predict: 1,
  investigate: 1,
  create: 1,
  reflect: 1,
  branch: 0,
});

export const QUEST_WORKLOAD_LIMITS = {
  5: {
    constraints: { min: 2, max: 2 },
    completionCriteria: { min: 1, max: 1 },
  },
  10: {
    constraints: { min: 2, max: 3 },
    completionCriteria: { min: 1, max: 2 },
  },
  15: {
    constraints: { min: 2, max: 4 },
    completionCriteria: { min: 1, max: 4 },
  },
} as const satisfies Record<QuestDuration, QuestWorkloadLimits>;

export function questTimeBudgetFor(
  durationMinutes: QuestDuration,
): QuestTimeBudget {
  const budget = QUEST_TIME_BUDGETS[durationMinutes];
  return { totalMinutes: budget.totalMinutes, steps: { ...budget.steps } };
}

export function timeBudgetTotal(budget: QuestTimeBudget): number {
  return Object.values(budget.steps).reduce(
    (total, minutes) => total + minutes,
    0,
  );
}

/** Recognizes only the exact pre-Branch-allocation five-minute profile. */
export function isLegacyFiveMinuteTimeBudget(
  value: unknown,
): value is QuestTimeBudget {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const budget = value as Record<string, unknown>;
  const steps = budget.steps;
  if (!steps || typeof steps !== "object" || Array.isArray(steps)) return false;
  const candidate = steps as Record<string, unknown>;
  const expectedKeys = Object.keys(LEGACY_FIVE_MINUTE_STEPS) as Array<
    keyof typeof LEGACY_FIVE_MINUTE_STEPS
  >;

  return (
    Object.keys(budget).length === 2 &&
    Object.hasOwn(budget, "totalMinutes") &&
    Object.hasOwn(budget, "steps") &&
    budget.totalMinutes === 5 &&
    Object.keys(candidate).length === expectedKeys.length &&
    expectedKeys.every(
      (step) => candidate[step] === LEGACY_FIVE_MINUTE_STEPS[step],
    )
  );
}

export function questWorkloadLimitsFor(
  durationMinutes: QuestDuration,
): QuestWorkloadLimits {
  return QUEST_WORKLOAD_LIMITS[durationMinutes];
}

export function isQuestTimeBudgetForDuration(
  budget: QuestTimeBudget,
  durationMinutes: QuestDuration,
): boolean {
  const expected = QUEST_TIME_BUDGETS[durationMinutes];
  return (
    budget.totalMinutes === durationMinutes &&
    timeBudgetTotal(budget) === durationMinutes &&
    (Object.keys(expected.steps) as TimedQuestStep[]).every(
      (step) => budget.steps[step] === expected.steps[step],
    )
  );
}

export function usesCompactEvidenceDecision(
  durationMinutes: QuestDuration,
): boolean {
  return durationMinutes <= 10;
}
