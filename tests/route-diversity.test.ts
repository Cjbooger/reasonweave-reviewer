import { describe, expect, it } from "vitest";

import seededDemo from "@/data/demo-underwater.json";
import {
  assertRouteDiversity,
  hasRouteDiversity,
  validateRouteDiversity,
} from "@/lib/route-diversity";
import { routesResponseSchema } from "@/lib/schemas";

const routes = () =>
  routesResponseSchema.parse({ routes: seededDemo.routes }).routes;

describe("route diversity", () => {
  it("accepts three routes with distinct methods and an active creation route", () => {
    const result = validateRouteDiversity(routes());

    expect(result).toEqual({ valid: true, issues: [] });
    expect(hasRouteDiversity(routes())).toBe(true);
    assertRouteDiversity(routes());
  });

  it("rejects duplicate thinking lenses even when titles differ", () => {
    const candidates = routes();
    candidates[2] = { ...candidates[2], lens: candidates[0].lens };
    const result = validateRouteDiversity(candidates);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "duplicate_lens",
    );
  });

  it("rejects duplicate activity methods hidden behind different hooks", () => {
    const candidates = routes();
    candidates[2] = {
      ...candidates[2],
      activityType: candidates[0].activityType,
    };
    const result = validateRouteDiversity(candidates);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "duplicate_activity",
    );
  });

  it("detects near-duplicate route titles", () => {
    const candidates = routes();
    candidates[0] = { ...candidates[0], title: "Map Ocean Pressure" };
    candidates[1] = { ...candidates[1], title: "Pressure Ocean Map" };
    const result = validateRouteDiversity(candidates);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "near_duplicate_title",
    );
  });

  it("reports the exact route-count contract", () => {
    const result = validateRouteDiversity(routes().slice(0, 2));

    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: "route_count" });
  });
});
