import { describe, expect, it } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import {
  FINAL_MAP_OVERVIEW_LAYOUT,
  layoutCuriosityMap,
  layoutFinalCuriosityMap,
} from "@/lib/map-layout";
import { seededDemoSessionSchema } from "@/lib/schemas";

const seededDemo = seededDemoSessionSchema.parse(seededDemoJson);
const finalMap = seededDemo.map!;

describe("deterministic Curiosity Map layout", () => {
  it("returns identical coordinates for identical input", () => {
    const first = layoutCuriosityMap(finalMap);
    const second = layoutCuriosityMap(structuredClone(finalMap));

    expect(second).toEqual(first);
    expect(first.width).toBe(960);
    expect(first.height).toBe(1_068);
  });

  it("lays out the active path centrally and fans out exactly three questions", () => {
    const layout = layoutCuriosityMap(finalMap);
    const position = (id: string) =>
      layout.nodes.find((node) => node.id === id)?.position;

    expect(position("question")).toEqual({ x: 370, y: 36 });
    expect(position("reflection")).toEqual({ x: 370, y: 776 });
    expect(position("next-question-1")).toEqual({ x: 52, y: 924 });
    expect(position("next-question-2")).toEqual({ x: 370, y: 924 });
    expect(position("next-question-3")).toEqual({ x: 688, y: 924 });
  });

  it("derives coordinates from graph semantics rather than input order", () => {
    const shuffled = {
      nodes: [...finalMap.nodes].reverse(),
      edges: [...finalMap.edges].reverse(),
    };
    const original = layoutCuriosityMap(finalMap);
    const reordered = layoutCuriosityMap(shuffled);
    const positions = (layout: typeof original) =>
      Object.fromEntries(layout.nodes.map((node) => [node.id, node.position]));

    expect(positions(reordered)).toEqual(positions(original));
  });

  it("supports a narrow deterministic canvas without changing the graph", () => {
    const layout = layoutCuriosityMap(finalMap, {
      width: 600,
      nodeWidth: 180,
      sidePadding: 30,
    });

    expect(layout.width).toBe(600);
    expect(layout.nodes).toHaveLength(9);
    expect(layout.edges).toEqual(finalMap.edges);
    expect(
      layout.nodes.find((node) => node.id === "question")?.position.x,
    ).toBe(210);
  });

  it("fits the completed trail into a deterministic three-row overview", () => {
    const first = layoutFinalCuriosityMap(finalMap);
    const second = layoutFinalCuriosityMap(structuredClone(finalMap));
    const position = (id: string) =>
      first.nodes.find((node) => node.id === id)?.position;

    expect(second).toEqual(first);
    expect(first.width).toBe(860);
    expect(first.height).toBe(489);
    expect(first.height).toBeLessThan(layoutCuriosityMap(finalMap).height / 2);
    expect(position("question")).toEqual({ x: 24, y: 20 });
    expect(position("prediction")).toEqual({ x: 612, y: 20 });
    expect(position("evidence")).toEqual({ x: 612, y: 180 });
    expect(position("reflection")).toEqual({ x: 24, y: 180 });
    expect(position("next-question-1")).toEqual({ x: 24, y: 340 });
    expect(position("next-question-2")).toEqual({ x: 318, y: 340 });
    expect(position("next-question-3")).toEqual({ x: 612, y: 340 });

    for (const node of first.nodes) {
      expect(node.position.x).toBeGreaterThanOrEqual(0);
      expect(node.position.y).toBeGreaterThanOrEqual(0);
      expect(
        node.position.x + FINAL_MAP_OVERVIEW_LAYOUT.nodeWidth,
      ).toBeLessThanOrEqual(first.width);
      expect(
        node.position.y + FINAL_MAP_OVERVIEW_LAYOUT.nodeHeight,
      ).toBeLessThanOrEqual(first.height);
    }
  });

  it("keeps overview positions stable when graph input order changes", () => {
    const shuffled = {
      nodes: [...finalMap.nodes].reverse(),
      edges: [...finalMap.edges].reverse(),
    };
    const original = layoutFinalCuriosityMap(finalMap);
    const reordered = layoutFinalCuriosityMap(shuffled);
    const positions = (layout: typeof original) =>
      Object.fromEntries(layout.nodes.map((node) => [node.id, node.position]));

    expect(positions(reordered)).toEqual(positions(original));
    expect(reordered.edges).toEqual(shuffled.edges);
  });

  it("retains the layered layout for an incomplete graph", () => {
    const partialMap = {
      nodes: finalMap.nodes.slice(0, 4),
      edges: finalMap.edges.slice(0, 3),
    };

    expect(layoutFinalCuriosityMap(partialMap)).toEqual(
      layoutCuriosityMap(partialMap),
    );
  });
});
