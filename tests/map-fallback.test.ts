import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import { buildMapFallbackItems } from "@/lib/map-fallback";
import { seededDemoSessionSchema } from "@/lib/schemas";

describe("Curiosity Map text fallback", () => {
  it("derives the complete nine-node journey without the graph layout", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const items = buildMapFallbackItems(session);

    expect(items).toHaveLength(9);
    expect(items.every((item) => item.reached)).toBe(true);
    expect(items[0]).toMatchObject({
      id: "question",
      kind: "question",
      label: session.question,
    });
    const evidenceLabel = items.find((item) => item.id === "evidence")?.label;
    expect(evidenceLabel).toBe(
      "Complicates prediction — Source boundary: A 100-person habitat's safety and independence",
    );
    expect(evidenceLabel?.length).toBeGreaterThan(70);
    expect(evidenceLabel?.length).toBeLessThanOrEqual(180);
    expect(items.find((item) => item.id === "creation")?.label).toBe(
      session.evidenceApplication!.designChoice,
    );
    expect(items.slice(-3).map((item) => item.label)).toEqual(
      session.reflectionResult?.newQuestions,
    );
  });

  it("marks future stages without relying on map or layout data", () => {
    const complete = seededDemoSessionSchema.parse(seededDemoJson);
    const items = buildMapFallbackItems({
      ...complete,
      selectedRouteId: undefined,
      prediction: undefined,
      evidence: undefined,
      evidenceDecision: undefined,
      evidenceApplication: undefined,
      artifact: undefined,
      reflectionInput: undefined,
      reflectionResult: undefined,
      map: undefined,
      step: "choose",
    });

    expect(items[0].reached).toBe(true);
    expect(items.slice(1).every((item) => !item.reached)).toBe(true);
  });
});
