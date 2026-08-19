import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import { exportSessionToMarkdown } from "@/lib/export-markdown";
import {
  buildCuriosityMap,
  mapToTextOutline,
  validateMapIntegrity,
} from "@/lib/map";
import { layoutCuriosityMap } from "@/lib/map-layout";
import { validateRouteDiversity } from "@/lib/route-diversity";
import {
  createCuriositySession,
  transitionSession,
} from "@/lib/session-machine";
import {
  finalCuriosityMapSchema,
  seededDemoSessionSchema,
} from "@/lib/schemas";
import { SEEDED_FALLBACK_DISCLOSURE } from "@/types/curiosity";

const SEEDED_AT = "2026-07-16T12:00:00.000Z";

describe("seeded underwater full flow", () => {
  it("replays the same guarded state transitions used by a live quest", () => {
    const fixture = seededDemoSessionSchema.parse(seededDemoJson);
    let session = createCuriositySession(
      {
        question: fixture.question,
        level: fixture.level,
        durationMinutes: fixture.durationMinutes,
        mode: "seeded_fallback",
      },
      { id: "seeded-replay", now: SEEDED_AT },
    );

    session = transitionSession(session, {
      type: "ROUTES_GENERATED",
      routes: fixture.routes,
      at: SEEDED_AT,
    });
    session = transitionSession(session, {
      type: "ROUTE_SELECTED",
      routeId: fixture.selectedRouteId!,
      at: SEEDED_AT,
    });
    session = transitionSession(session, {
      type: "QUEST_LOADED",
      quest: fixture.quest!,
      at: SEEDED_AT,
    });
    session = transitionSession(session, {
      type: "PREDICTION_SUBMITTED",
      prediction: fixture.prediction!,
      at: SEEDED_AT,
    });
    session = transitionSession(session, {
      type: "EVIDENCE_LOADED",
      evidence: fixture.evidence!,
      at: SEEDED_AT,
    });
    session = transitionSession(session, {
      type: "ARTIFACT_SUBMITTED",
      artifact: fixture.artifact!,
      evidenceDecision: fixture.evidenceDecision!,
      evidenceApplication: fixture.evidenceApplication!,
      at: SEEDED_AT,
    });
    session = transitionSession(session, {
      type: "REFLECTION_COMPLETED",
      reflectionInput: fixture.reflectionInput!,
      reflectionResult: fixture.reflectionResult!,
      at: SEEDED_AT,
    });
    session = transitionSession(session, {
      type: "NEXT_QUESTION_SELECTED",
      nextQuestionId: fixture.selectedNextQuestionId!,
      at: SEEDED_AT,
    });

    expect(session.step).toBe("branch");
    expect(session.mode).toBe("seeded_fallback");
    expect(session.seededDisclosure).toBe(SEEDED_FALLBACK_DISCLOSURE);
    expect(session.routes).toHaveLength(3);
    expect(validateRouteDiversity(session.routes).valid).toBe(true);
    expect(session.evidence?.items.length).toBeGreaterThanOrEqual(2);
    expect(session.evidence?.items.length).toBeLessThanOrEqual(4);
    expect(session.evidenceDecision).toEqual(fixture.evidenceDecision);
    expect(session.reflectionResult?.newQuestions).toHaveLength(3);
    expect(session.selectedNextQuestionId).toBe("next-question-3");

    expect(finalCuriosityMapSchema.safeParse(session.map).success).toBe(true);
    expect(validateMapIntegrity(session.map!).valid).toBe(true);
    expect(layoutCuriosityMap(session.map!).nodes).toHaveLength(9);

    const outline = mapToTextOutline(session.map!);
    expect(outline).toContain(
      "Starting question: Could humans live underwater?",
    );
    expect(outline).toContain(
      "Evidence decision: Complicates — Source boundary: A 100-person habitat's safety and independence",
    );
    expect(outline).toContain("Selected finding: FIU's Aquarius lab");
    expect(outline).toContain(
      "Changed model: Maintenance, food, and redundant life support may be… depends on the others",
    );
    expect(outline.match(/Next question:/g)).toHaveLength(3);

    const preDecisionOutline = mapToTextOutline(
      buildCuriosityMap({
        ...session,
        evidenceDecision: undefined,
        artifact: undefined,
        reflectionInput: undefined,
        reflectionResult: undefined,
        map: undefined,
        step: "create",
      }),
    );
    expect(preDecisionOutline).toContain("Evidence cluster:");
    expect(preDecisionOutline).toContain("Evidence details:");
    expect(preDecisionOutline).not.toContain("Evidence decision:");
    expect(preDecisionOutline).not.toContain("Selected finding:");

    const markdown = exportSessionToMarkdown(session);
    expect(markdown).toContain("Pre-generated demo");
    expect(markdown).toContain("Learner evidence decision");
    expect(markdown).toContain("My next question");
    expect(markdown).toContain("Three next questions");
    fixture.reflectionResult!.newQuestions.forEach((question) => {
      expect(markdown).toContain(question);
    });
  });

  it("associates every Evidence item only with returned source records", () => {
    const fixture = seededDemoSessionSchema.parse(seededDemoJson);
    const returnedSourceIds = new Set(
      fixture.evidence?.sources.map((source) => source.id),
    );

    fixture.evidence?.items.forEach((item) => {
      if (item.kind === "evidence") {
        expect(item.sourceIds.length).toBeGreaterThan(0);
      }
      item.sourceIds.forEach((sourceId) => {
        expect(returnedSourceIds.has(sourceId)).toBe(true);
      });
    });
  });
});
