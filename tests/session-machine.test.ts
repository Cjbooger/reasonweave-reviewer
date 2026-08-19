import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import {
  canRevealEvidence,
  createCuriositySession,
  getSelectedRoute,
  migrateStoredCuriositySession,
  SessionTransitionError,
  transitionSession,
  type SessionEvent,
} from "@/lib/session-machine";
import { curiositySessionSchema, seededDemoSessionSchema } from "@/lib/schemas";
import type { CuriositySession } from "@/types/curiosity";
import { questTimeBudgetFor } from "@/lib/quest-time-budget";

const seededDemo = seededDemoSessionSchema.parse(seededDemoJson);
const AT = "2026-07-16T12:00:00.000Z";

function sessionAtPredict(): CuriositySession {
  let session = createCuriositySession(
    {
      question: seededDemo.question,
      level: seededDemo.level,
      durationMinutes: seededDemo.durationMinutes,
    },
    { id: "test-session", now: AT },
  );
  session = transitionSession(session, {
    type: "ROUTES_GENERATED",
    routes: seededDemo.routes,
    at: AT,
  });
  session = transitionSession(session, {
    type: "ROUTE_SELECTED",
    routeId: seededDemo.selectedRouteId!,
    at: AT,
  });
  session = transitionSession(session, {
    type: "QUEST_LOADED",
    quest: seededDemo.quest!,
    at: AT,
  });
  return session;
}

function sessionAtCreate(): CuriositySession {
  let session = sessionAtPredict();
  session = transitionSession(session, {
    type: "PREDICTION_SUBMITTED",
    prediction: seededDemo.prediction!,
    at: AT,
  });
  return transitionSession(session, {
    type: "EVIDENCE_LOADED",
    evidence: seededDemo.evidence!,
    at: AT,
  });
}

describe("session state machine", () => {
  it("enforces the complete finite learning-loop order", () => {
    let session = sessionAtPredict();

    expect(session.step).toBe("predict");
    expect(canRevealEvidence(session)).toBe(false);
    expect(getSelectedRoute(session)?.title).toBe("Design the Habitat");

    session = transitionSession(session, {
      type: "PREDICTION_SUBMITTED",
      prediction: seededDemo.prediction!,
      at: AT,
    });
    expect(session.step).toBe("investigate");
    expect(canRevealEvidence(session)).toBe(true);

    session = transitionSession(session, {
      type: "EVIDENCE_LOADED",
      evidence: seededDemo.evidence!,
      at: AT,
    });
    expect(session.step).toBe("create");

    session = transitionSession(session, {
      type: "ARTIFACT_SUBMITTED",
      artifact: seededDemo.artifact!,
      evidenceDecision: seededDemo.evidenceDecision!,
      evidenceApplication: seededDemo.evidenceApplication!,
      at: AT,
    });
    expect(session.step).toBe("reflect");
    expect(session.evidenceDecision).toEqual(seededDemo.evidenceDecision);
    expect(session.evidenceApplication).toEqual(seededDemo.evidenceApplication);

    session = transitionSession(session, {
      type: "REFLECTION_COMPLETED",
      reflectionInput: seededDemo.reflectionInput!,
      reflectionResult: seededDemo.reflectionResult!,
      at: AT,
    });

    expect(session.step).toBe("branch");
    expect(session.map?.nodes).toHaveLength(9);
    expect(session.map?.edges).toHaveLength(8);
    expect(session.reflectionResult?.newQuestions).toHaveLength(3);

    const branchSession = session;
    session = transitionSession(session, {
      type: "NEXT_QUESTION_SELECTED",
      nextQuestionId: "next-question-3",
      at: AT,
    });

    expect(branchSession.selectedNextQuestionId).toBeUndefined();
    expect(session.selectedNextQuestionId).toBe("next-question-3");
    expect(
      session.map?.edges.find(
        (edge) => edge.target === session.selectedNextQuestionId,
      )?.label,
    ).toBe("I’ll explore next");
  });

  it("accepts a next-question commitment only at Branch", () => {
    const predictSession = sessionAtPredict();
    expect(() =>
      transitionSession(predictSession, {
        type: "NEXT_QUESTION_SELECTED",
        nextQuestionId: "next-question-3",
        at: AT,
      }),
    ).toThrow("NEXT_QUESTION_SELECTED is not allowed during the predict step");
  });

  it("atomically validates the artifact, source-backed judgment, and evidence-to-design link", () => {
    const session = sessionAtCreate();
    const before = structuredClone(session);

    const missingDecision = {
      type: "ARTIFACT_SUBMITTED",
      artifact: seededDemo.artifact!,
      at: AT,
    } as unknown as SessionEvent;
    expect(() => transitionSession(session, missingDecision)).toThrow();

    expect(() =>
      transitionSession(session, {
        type: "ARTIFACT_SUBMITTED",
        artifact: seededDemo.artifact!,
        evidenceDecision: {
          ...seededDemo.evidenceDecision!,
          evidenceItemId: "closed-loop-systems",
        },
        evidenceApplication: {
          ...seededDemo.evidenceApplication!,
          evidenceItemId: "closed-loop-systems",
        },
        at: AT,
      }),
    ).toThrow("source-backed evidence finding");

    expect(() =>
      transitionSession(session, {
        type: "ARTIFACT_SUBMITTED",
        artifact: seededDemo.artifact!,
        evidenceDecision: seededDemo.evidenceDecision!,
        evidenceApplication: {
          ...seededDemo.evidenceApplication!,
          evidenceItemId: "pressure-increases",
        },
        at: AT,
      }),
    ).toThrow("Link the design choice to the source-backed finding");

    const missingAnchor = structuredClone(seededDemo.evidenceApplication!);
    delete missingAnchor.artifactAnchor;
    expect(() =>
      transitionSession(session, {
        type: "ARTIFACT_SUBMITTED",
        artifact: seededDemo.artifact!,
        evidenceDecision: seededDemo.evidenceDecision!,
        evidenceApplication: missingAnchor,
        at: AT,
      }),
    ).toThrow("Add a 2–8 word creation anchor");

    expect(() =>
      transitionSession(session, {
        type: "ARTIFACT_SUBMITTED",
        artifact: seededDemo.artifact!,
        evidenceDecision: seededDemo.evidenceDecision!,
        evidenceApplication: {
          ...seededDemo.evidenceApplication!,
          artifactAnchor: "detachable habitat shell",
        },
        at: AT,
      }),
    ).toThrow("appears exactly in your evidence-driven design move");

    expect(() =>
      transitionSession(session, {
        type: "ARTIFACT_SUBMITTED",
        artifact:
          "At 20 meters, I would use a surface-linked support module and a detachable service dock for safer maintenance, while keeping surface infrastructure available for repairs.",
        evidenceDecision: seededDemo.evidenceDecision!,
        evidenceApplication: seededDemo.evidenceApplication!,
        at: AT,
      }),
    ).toThrow("Repeat that exact creation anchor");

    expect(() =>
      transitionSession(session, {
        type: "ARTIFACT_SUBMITTED",
        artifact: "too short",
        evidenceDecision: seededDemo.evidenceDecision!,
        evidenceApplication: seededDemo.evidenceApplication!,
        at: AT,
      }),
    ).toThrow();

    expect(session).toEqual(before);
    expect(session.artifact).toBeUndefined();
    expect(session.evidenceDecision).toBeUndefined();
    expect(session.evidenceApplication).toBeUndefined();
    expect(session.step).toBe("create");
  });

  it("does not reveal evidence before a meaningful prediction", () => {
    const session = sessionAtPredict();

    expect(() =>
      transitionSession(session, {
        type: "EVIDENCE_LOADED",
        evidence: seededDemo.evidence!,
        at: AT,
      }),
    ).toThrow(SessionTransitionError);
    expect(() =>
      transitionSession(session, {
        type: "PREDICTION_SUBMITTED",
        prediction: "x",
        at: AT,
      }),
    ).toThrow();
    expect(canRevealEvidence(session)).toBe(false);
  });

  it("rejects a quest for any route other than the selected one", () => {
    let session = createCuriositySession(
      {
        question: seededDemo.question,
        level: seededDemo.level,
        durationMinutes: seededDemo.durationMinutes,
      },
      { id: "wrong-route-test", now: AT },
    );
    session = transitionSession(session, {
      type: "ROUTES_GENERATED",
      routes: seededDemo.routes,
      at: AT,
    });
    session = transitionSession(session, {
      type: "ROUTE_SELECTED",
      routeId: "survive-pressure",
      at: AT,
    });

    expect(() =>
      transitionSession(session, {
        type: "QUEST_LOADED",
        quest: seededDemo.quest!,
        at: AT,
      }),
    ).toThrow("does not belong to the selected route");
  });

  it("keeps prior state immutable when selecting a route", () => {
    let session = createCuriositySession(
      {
        question: seededDemo.question,
        level: seededDemo.level,
        durationMinutes: seededDemo.durationMinutes,
      },
      { id: "immutability-test", now: AT },
    );
    session = transitionSession(session, {
      type: "ROUTES_GENERATED",
      routes: seededDemo.routes,
      at: AT,
    });
    const before = structuredClone(session);

    const selected = transitionSession(session, {
      type: "ROUTE_SELECTED",
      routeId: "design-habitat",
      at: AT,
    });

    expect(session).toEqual(before);
    expect(session.selectedRouteId).toBeUndefined();
    expect(selected.selectedRouteId).toBe("design-habitat");
  });

  it("prevents timestamps from moving backwards", () => {
    const session = createCuriositySession(
      {
        question: seededDemo.question,
        level: seededDemo.level,
        durationMinutes: seededDemo.durationMinutes,
      },
      { id: "time-test", now: "2026-07-16T12:01:00.000Z" },
    );

    expect(() =>
      transitionSession(session, {
        type: "ROUTES_GENERATED",
        routes: seededDemo.routes,
        at: AT,
      }),
    ).toThrow("cannot move updatedAt backwards");
  });

  it("upgrades a saved session from before time budgets were persisted", () => {
    const legacy = structuredClone(seededDemo);
    legacy.quest?.constraints.push(
      "A historical fourth constraint that exceeds the focused workload.",
      "A historical fifth constraint that remains part of the saved trace.",
    );
    legacy.quest?.completionCriteria.push(
      "A historical third criterion that exceeds the focused workload.",
      "A historical fourth criterion that remains part of the saved trace.",
    );
    delete (legacy.quest as { timeBudget?: unknown }).timeBudget;

    expect(seededDemoSessionSchema.safeParse(legacy).success).toBe(false);
    const migrated = migrateStoredCuriositySession(legacy);
    const parsed = curiositySessionSchema.safeParse(migrated);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quest?.timeBudget).toEqual(questTimeBudgetFor(10));
      expect(
        parsed.data.quest && "workloadProfile" in parsed.data.quest
          ? parsed.data.quest.workloadProfile
          : undefined,
      ).toBe("pre_time_budget");
      expect(parsed.data.quest?.constraints).toHaveLength(4);
      expect(parsed.data.quest?.completionCriteria).toHaveLength(3);
    }
  });

  it("upgrades the exact prior five-minute budget without losing learner work", () => {
    const legacy = structuredClone(seededDemo);
    legacy.durationMinutes = 5;
    legacy.quest!.timeBudget = {
      totalMinutes: 5,
      steps: {
        choose: 1,
        predict: 1,
        investigate: 1,
        create: 1,
        reflect: 1,
        branch: 0,
      },
    };
    const learnerWork = {
      evidenceDecision: structuredClone(legacy.evidenceDecision),
      evidenceApplication: structuredClone(legacy.evidenceApplication),
      artifact: legacy.artifact,
      reflectionInput: structuredClone(legacy.reflectionInput),
    };

    expect(curiositySessionSchema.safeParse(legacy).success).toBe(false);
    const migrated = migrateStoredCuriositySession(legacy);
    const parsed = curiositySessionSchema.safeParse(migrated);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quest?.timeBudget).toEqual(questTimeBudgetFor(5));
      expect(
        parsed.data.quest && "workloadProfile" in parsed.data.quest
          ? parsed.data.quest.workloadProfile
          : undefined,
      ).toBeUndefined();
      expect(parsed.data.quest?.constraints).toEqual(legacy.quest?.constraints);
      expect(parsed.data.quest?.completionCriteria).toEqual(
        legacy.quest?.completionCriteria,
      );
      expect(parsed.data.evidenceDecision).toEqual(
        learnerWork.evidenceDecision,
      );
      expect(parsed.data.evidenceApplication).toEqual(
        learnerWork.evidenceApplication,
      );
      expect(parsed.data.artifact).toBe(learnerWork.artifact);
      expect(parsed.data.reflectionInput).toEqual(learnerWork.reflectionInput);
    }
  });

  it("returns a pre-anchor Reflect session to Create without rewriting learner work", () => {
    const legacyReflect = structuredClone(seededDemo);
    legacyReflect.step = "reflect";
    delete legacyReflect.evidenceApplication!.artifactAnchor;
    delete legacyReflect.reflectionInput;
    delete legacyReflect.reflectionResult;
    delete legacyReflect.selectedNextQuestionId;
    delete legacyReflect.map;

    const migrated = migrateStoredCuriositySession(legacyReflect);
    const parsed = curiositySessionSchema.parse(migrated);

    expect(parsed.step).toBe("create");
    expect(parsed.evidenceApplication?.designChoice).toBe(
      legacyReflect.evidenceApplication!.designChoice,
    );
    expect(parsed.evidenceApplication?.artifactAnchor).toBeUndefined();
    expect(parsed.artifact).toBe(legacyReflect.artifact);
  });

  it("does not repair a near-match five-minute budget", () => {
    const invalid = structuredClone(seededDemo);
    invalid.durationMinutes = 5;
    invalid.quest!.timeBudget = {
      totalMinutes: 5,
      steps: {
        choose: 0.5,
        predict: 1.5,
        investigate: 1,
        create: 1,
        reflect: 1,
        branch: 0,
      },
    };

    expect(migrateStoredCuriositySession(invalid)).toEqual(invalid);
    expect(curiositySessionSchema.safeParse(invalid).success).toBe(false);
  });

  it("does not repair an old-shaped budget with extra fields", () => {
    const invalid = structuredClone(seededDemo) as typeof seededDemo & {
      quest: NonNullable<typeof seededDemo.quest>;
    };
    invalid.durationMinutes = 5;
    invalid.quest.timeBudget = {
      totalMinutes: 5,
      steps: {
        choose: 1,
        predict: 1,
        investigate: 1,
        create: 1,
        reflect: 1,
        branch: 0,
      },
      unexpected: "do not silently remove this field",
    } as typeof invalid.quest.timeBudget;

    expect(migrateStoredCuriositySession(invalid)).toEqual(invalid);
    expect(curiositySessionSchema.safeParse(invalid).success).toBe(false);
  });
});
