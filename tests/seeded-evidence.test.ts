import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import { seededEvidenceForRoute } from "@/lib/seeded-evidence";
import { evidenceBundleSchema, routesResponseSchema } from "@/lib/schemas";

const routes = routesResponseSchema.parse({
  routes: seededDemoJson.routes,
}).routes;

describe("route-specific seeded Evidence Lenses", () => {
  it("provides a valid reviewed bundle with evidence, inference, and uncertainty for every route", () => {
    const signatures = new Set<string>();

    for (const route of routes) {
      const bundle = seededEvidenceForRoute(route);
      expect(evidenceBundleSchema.safeParse(bundle).success).toBe(true);
      expect(bundle.items.map((item) => item.kind)).toEqual(
        expect.arrayContaining(["evidence", "inference", "open_question"]),
      );

      const sourceIds = new Set(bundle.sources.map((source) => source.id));
      for (const item of bundle.items) {
        if (item.kind === "evidence") {
          expect(item.sourceIds.length).toBeGreaterThan(0);
        }
        for (const sourceId of item.sourceIds) {
          expect(sourceIds.has(sourceId)).toBe(true);
        }
      }

      signatures.add(bundle.items.map((item) => item.id).join("|"));
    }

    expect(signatures.size).toBe(3);
  });

  it("keeps pressure, habitat, and ecosystem claims aligned to the chosen method", () => {
    const pressure = seededEvidenceForRoute({ id: "survive-pressure" });
    expect(pressure.conciseExplanation).toMatch(/depth|pressure/i);
    expect(pressure.sources.map((source) => source.domain)).toEqual(
      expect.arrayContaining(["oceanservice.noaa.gov", "environment.fiu.edu"]),
    );

    const habitat = seededEvidenceForRoute({ id: "design-habitat" });
    expect(habitat.conciseExplanation).toMatch(/life support|support systems/i);
    expect(habitat.sources.map((source) => source.domain)).toContain(
      "nasa.gov",
    );

    const ecosystem = seededEvidenceForRoute({ id: "protect-ocean" });
    expect(ecosystem.conciseExplanation).toMatch(/sound|water quality/i);
    expect(ecosystem.sources.map((source) => source.url)).toEqual([
      "https://www.fisheries.noaa.gov/insight/understanding-sound-ocean",
      "https://www.epa.gov/npdes/npdes-permit-basics",
    ]);
    expect(
      ecosystem.items.find((item) => item.kind === "open_question")?.sourceIds,
    ).toEqual([]);
  });

  it("fails closed for an unknown demo route instead of reusing unrelated evidence", () => {
    expect(() => seededEvidenceForRoute({ id: "unknown-route" })).toThrow(
      /No seeded Evidence Lens exists/,
    );
  });
});
