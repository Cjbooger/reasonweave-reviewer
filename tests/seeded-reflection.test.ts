import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import { evidenceDecisionNarrative } from "@/lib/evidence-decision";
import { evidenceDecisionGroundingIssues } from "@/lib/reflection-quality";
import { reflectionResultSchema, seededDemoSessionSchema } from "@/lib/schemas";
import { buildSeededReflection } from "@/lib/seeded-reflection";

describe("deterministic seeded reflection feedback", () => {
  it("keeps the learner's evidence judgment, creation, changed model, and tradeoff in natural prose", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const route = session.routes.find(
      (candidate) => candidate.id === session.selectedRouteId,
    )!;

    const result = buildSeededReflection(
      route,
      session.reflectionInput!,
      session.artifact!,
      session.evidence!,
      session.evidenceDecision!,
      session.evidenceApplication!,
    );

    expect(result.specificFeedback).toBe(
      "Your evidence judgment (complicates): That complicates my pressure-first prediction because surface dependence is another major constraint. Evidence used: FIU's Aquarius lab supports up to six crew and relies on a surface buoy for power, air, and data. Still unresolved: A 100-person habitat's safety and independence remain unresolved. Evidence-to-design link: Because Aquarius relies on surface systems, my design accepts regular deliveries and adds a detachable service module for safer maintenance. Your creation: At 20 meters, I would use a surface-linked support module with regular deliveries and a detachable service dock. Still wondering: whether an underwater habitat could ever become mostly self-sufficient without harming the surrounding ecosystem.",
    );
    expect(result.specificFeedback).toContain(
      "Your creation: At 20 meters, I would use a surface-linked support module",
    );
    expect(result.specificFeedback).toContain(
      "Still wondering: whether an underwater habitat could ever become",
    );
    expect(result.specificFeedback.length).toBeLessThanOrEqual(800);
    expect(result.changedThinking).toBe(
      "At first, you thought pressure was the only serious obstacle because the ocean could crush the habitat. After investigating, you concluded maintenance, food, and redundant life support may be harder over time because every system depends on the others.",
    );
    expect(result.keyTradeoff).toBe(
      "More surface access reduces isolation and repair risk, but it limits self-sufficiency and adds dependence on external infrastructure.",
    );
    expect(`${result.specificFeedback} ${result.changedThinking}`).not.toMatch(
      /[“”…]/,
    );
    expect(reflectionResultSchema.safeParse(result).success).toBe(true);
    const selectedFinding = session.evidence!.items.find(
      (item) => item.id === session.evidenceDecision!.evidenceItemId,
    )!;
    expect(
      evidenceDecisionGroundingIssues(result, {
        relationship: session.evidenceDecision!.relationship,
        reason: evidenceDecisionNarrative(session.evidenceDecision!),
        selectedFinding: selectedFinding.statement,
        designChoice: session.evidenceApplication!.designChoice,
      }),
    ).toEqual([]);
  });

  it("preserves the evidence judgment and artifact while bounding summaries at sentence breaks", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const route = session.routes.find(
      (candidate) => candidate.id === session.selectedRouteId,
    )!;
    const evidence = structuredClone(session.evidence!);
    const selected = evidence.items.find(
      (item) => item.id === session.evidenceDecision!.evidenceItemId,
    )!;
    selected.statement =
      "Surface support changes the maintenance model. This extra sentence should not be repeated in the final feedback.";

    const result = buildSeededReflection(
      route,
      {
        usedToThink:
          "I used to think pressure settled the design. This extra sentence should not be repeated.",
        nowThink:
          "Now I think maintenance connects every system. This extra sentence should not be repeated.",
        stillWonder: session.reflectionInput!.stillWonder,
      },
      "A service dock keeps repairs separate from living areas. This second artifact sentence should not be repeated.",
      evidence,
      {
        ...session.evidenceDecision!,
        establishes:
          "The finding establishes that repairs depend on the surface.",
        unresolved:
          "It does not establish that the habitat can operate independently.",
        impact:
          "That complicates the prediction because maintenance remains a second constraint.",
      },
      {
        ...session.evidenceApplication!,
        designChoice:
          "Because repairs depend on the surface, I added a service dock that keeps repairs separate from living areas.",
      },
    );

    expect(result.specificFeedback).toBe(
      "Your evidence judgment (complicates): That complicates the prediction because maintenance remains a second constraint. Evidence used: Surface support changes the maintenance model. Still unresolved: It does not establish that the habitat can operate independently. Evidence-to-design link: Because repairs depend on the surface, I added a service dock that keeps repairs separate from living areas. Your creation: A service dock keeps repairs separate from living areas. Still wondering: whether an underwater habitat could ever become mostly self-sufficient without harming the surrounding ecosystem.",
    );
    expect(result.changedThinking).toBe(
      "At first, you thought pressure settled the design. After investigating, you concluded maintenance connects every system.",
    );
    expect(result.specificFeedback).not.toContain("extra sentence");
    expect(result.changedThinking).not.toContain("extra sentence");
  });

  it("retains a bounded evidence-to-design link when maximum input would exceed the feedback contract", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const route = session.routes.find(
      (candidate) => candidate.id === session.selectedRouteId,
    )!;
    const oversizedSentence = `${"A deliberately detailed habitat choice ".repeat(30).trim()}.`;

    const result = buildSeededReflection(
      route,
      session.reflectionInput!,
      oversizedSentence,
      session.evidence!,
      session.evidenceDecision!,
      {
        ...session.evidenceApplication!,
        designChoice: oversizedSentence,
      },
    );

    expect(result.specificFeedback.length).toBeLessThanOrEqual(800);
    expect(result.specificFeedback).toContain("Evidence-to-design link");
    expect(result.specificFeedback).toContain("Your creation");
    expect(result.specificFeedback).toContain(
      "A deliberately detailed habitat choice",
    );
    expect(result.specificFeedback).toContain(
      "Still wondering: whether an underwater habitat could ever become",
    );
    expect(reflectionResultSchema.safeParse(result).success).toBe(true);
  });

  it("changes the feedback when only the learner's artifact changes", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const route = session.routes.find(
      (candidate) => candidate.id === session.selectedRouteId,
    )!;
    const baseline = buildSeededReflection(
      route,
      session.reflectionInput!,
      session.artifact!,
      session.evidence!,
      session.evidenceDecision!,
      session.evidenceApplication!,
    );
    const changed = buildSeededReflection(
      route,
      session.reflectionInput!,
      "A cobalt maintenance carousel would move damaged life-support modules into an isolated repair bay.",
      session.evidence!,
      session.evidenceDecision!,
      session.evidenceApplication!,
    );

    expect(baseline.specificFeedback).not.toContain(
      "cobalt maintenance carousel",
    );
    expect(changed.specificFeedback).toContain(
      "Your creation: A cobalt maintenance carousel",
    );
    expect(changed.specificFeedback).not.toBe(baseline.specificFeedback);
  });
});
