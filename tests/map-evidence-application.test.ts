import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import { buildCuriosityMap, mapToTextOutline } from "@/lib/map";
import { seededDemoSessionSchema } from "@/lib/schemas";

describe("Curiosity Map evidence-to-creation trace", () => {
  it("includes the exact learner-selected creation anchor", () => {
    const parsed = seededDemoSessionSchema.parse(seededDemoJson);
    const artifactAnchor =
      parsed.evidenceApplication!.artifactAnchor ?? "regular deliveries";
    const session = {
      ...parsed,
      evidenceApplication: {
        ...parsed.evidenceApplication!,
        artifactAnchor,
      },
    };

    const map = buildCuriosityMap(session);
    const creation = map.nodes.find((node) => node.id === "creation");

    expect(creation?.detail).toContain(`Creation anchor: “${artifactAnchor}”.`);
    expect(creation?.detail).toContain(
      `Learner creation: ${session.artifact!.slice(0, 80)}`,
    );
    expect(mapToTextOutline(map)).toContain(
      `Creation anchor: “${artifactAnchor}”.`,
    );
  });

  it("keeps the historical creation trace when no anchor was stored", () => {
    const session = structuredClone(
      seededDemoSessionSchema.parse(seededDemoJson),
    );
    delete session.evidenceApplication!.artifactAnchor;

    const creation = buildCuriosityMap(session).nodes.find(
      (node) => node.id === "creation",
    );

    expect(creation?.detail).toContain(
      `Evidence-to-design link: ${session.evidenceApplication!.designChoice}`,
    );
    expect(creation?.detail).toContain(
      `Learner creation: ${session.artifact!.slice(0, 80)}`,
    );
    expect(creation?.detail).not.toContain("Creation anchor:");
  });
});
