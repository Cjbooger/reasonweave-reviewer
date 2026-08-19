import { describe, expect, it } from "vitest";

import {
  isQuestTimeBudgetForDuration,
  QUEST_TIME_BUDGETS,
  QUEST_WORKLOAD_LIMITS,
  questTimeBudgetFor,
  questWorkloadLimitsFor,
  timeBudgetTotal,
} from "@/lib/quest-time-budget";
import { questTimeBudgetSchema } from "@/lib/schemas";

describe("quest time budgets", () => {
  it.each([5, 10, 15] as const)(
    "uses a canonical %i-minute budget",
    (duration) => {
      const budget = questTimeBudgetFor(duration);

      expect(questTimeBudgetSchema.safeParse(budget).success).toBe(true);
      expect(timeBudgetTotal(budget)).toBe(duration);
      expect(isQuestTimeBudgetForDuration(budget, duration)).toBe(true);
    },
  );

  it("rejects a time budget that has the right total but the wrong workload", () => {
    const changed = questTimeBudgetFor(10);
    changed.steps.create = 4;
    changed.steps.reflect = 1;

    expect(timeBudgetTotal(changed)).toBe(10);
    expect(questTimeBudgetSchema.safeParse(changed).success).toBe(false);
    expect(isQuestTimeBudgetForDuration(changed, 10)).toBe(false);
  });

  it.each([
    ["quarter-minute steps", { choose: 0.25, predict: 0.75 }],
    ["a zero-minute step", { choose: 0, predict: 1 }],
    ["a negative step", { choose: -0.5, predict: 1.5 }],
  ])("rejects %s even when the five-minute total still matches", (_, steps) => {
    const changed = questTimeBudgetFor(5);
    Object.assign(changed.steps, steps);

    expect(timeBudgetTotal(changed)).toBe(5);
    expect(questTimeBudgetSchema.safeParse(changed).success).toBe(false);
    expect(isQuestTimeBudgetForDuration(changed, 5)).toBe(false);
  });

  it("keeps the shipped profiles explicit", () => {
    expect(QUEST_TIME_BUDGETS[5].steps).toEqual({
      choose: 0.5,
      predict: 0.5,
      investigate: 1,
      create: 1.5,
      reflect: 1,
      branch: 0.5,
    });
    expect(
      Object.values(QUEST_TIME_BUDGETS[5].steps).every((step) => step > 0),
    ).toBe(true);
    expect(QUEST_TIME_BUDGETS[10].steps.create).toBe(3);
    expect(QUEST_TIME_BUDGETS[15].steps.create).toBe(5);
  });

  it("keeps short-quest workload caps explicit", () => {
    expect(questWorkloadLimitsFor(5)).toEqual({
      constraints: { min: 2, max: 2 },
      completionCriteria: { min: 1, max: 1 },
    });
    expect(QUEST_WORKLOAD_LIMITS[10]).toEqual({
      constraints: { min: 2, max: 3 },
      completionCriteria: { min: 1, max: 2 },
    });
    expect(QUEST_WORKLOAD_LIMITS[15]).toEqual({
      constraints: { min: 2, max: 4 },
      completionCriteria: { min: 1, max: 4 },
    });
  });
});
