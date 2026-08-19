import type {
  CuriosityMap,
  CuriosityMapEdge,
  CuriosityMapNode,
} from "@/types/curiosity";

export interface MapPosition {
  x: number;
  y: number;
}

export interface LayoutedCuriosityMapNode extends CuriosityMapNode {
  position: MapPosition;
}

export interface LayoutedCuriosityMap {
  nodes: LayoutedCuriosityMapNode[];
  edges: CuriosityMapEdge[];
  width: number;
  height: number;
}

export interface MapLayoutOptions {
  width?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  rowGap?: number;
  sidePadding?: number;
  topPadding?: number;
  bottomPadding?: number;
}

export const DEFAULT_MAP_LAYOUT = {
  width: 960,
  nodeWidth: 220,
  nodeHeight: 96,
  rowGap: 148,
  sidePadding: 52,
  topPadding: 36,
  bottomPadding: 48,
} as const;

/**
 * The completed map is a judge-facing overview rather than a scrolling work
 * surface. Six trail nodes snake across the first two rows and the three
 * finite next questions share the final row. Keeping this geometry in the
 * deterministic layout layer means the browser and recorded demo use the
 * exact same composition.
 */
export const FINAL_MAP_OVERVIEW_LAYOUT = {
  width: 860,
  nodeWidth: 224,
  nodeHeight: 125,
  rowGap: 160,
  sidePadding: 24,
  topPadding: 20,
  bottomPadding: 24,
} as const;

function computeDepths(map: CuriosityMap): Map<string, number> {
  const root = map.nodes.find((node) => node.kind === "question");
  const depths = new Map<string, number>();
  if (!root) return depths;

  depths.set(root.id, 0);
  const queue = [root.id];
  while (queue.length > 0) {
    const source = queue.shift();
    if (!source) continue;
    const sourceDepth = depths.get(source) ?? 0;

    const targets = map.edges
      .filter((edge) => edge.source === source)
      .map((edge) => edge.target)
      .sort();

    for (const target of targets) {
      const candidateDepth = sourceDepth + 1;
      const existingDepth = depths.get(target);
      if (existingDepth === undefined) {
        depths.set(target, candidateDepth);
        queue.push(target);
      }
    }
  }

  return depths;
}

/**
 * Computes a stable layered layout from semantic edges. The same map and options
 * always produce byte-for-byte equivalent positions.
 */
export function layoutCuriosityMap(
  map: CuriosityMap,
  options: MapLayoutOptions = {},
): LayoutedCuriosityMap {
  const settings = { ...DEFAULT_MAP_LAYOUT, ...options };
  const width = Math.max(
    settings.width,
    settings.nodeWidth + settings.sidePadding * 2,
  );
  const depths = computeDepths(map);
  const fallbackDepth =
    Math.max(0, ...Array.from(depths.values(), (depth) => depth)) + 1;

  const layers = new Map<number, CuriosityMapNode[]>();
  for (const node of map.nodes) {
    const depth = depths.get(node.id) ?? fallbackDepth;
    const layer = layers.get(depth) ?? [];
    layer.push(node);
    layers.set(depth, layer);
  }

  const positioned = new Map<string, LayoutedCuriosityMapNode>();
  const sortedDepths = [...layers.keys()].sort((left, right) => left - right);
  for (const depth of sortedDepths) {
    const layer = [...(layers.get(depth) ?? [])].sort((left, right) =>
      left.id.localeCompare(right.id, "en-US"),
    );
    const usableWidth = width - settings.sidePadding * 2 - settings.nodeWidth;
    const step = layer.length > 1 ? usableWidth / (layer.length - 1) : 0;

    layer.forEach((node, index) => {
      const x =
        layer.length === 1
          ? (width - settings.nodeWidth) / 2
          : settings.sidePadding + index * step;
      const y = settings.topPadding + depth * settings.rowGap;

      positioned.set(node.id, {
        ...node,
        position: {
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100,
        },
      });
    });
  }

  const maxDepth = Math.max(0, ...sortedDepths);
  const height =
    settings.topPadding +
    maxDepth * settings.rowGap +
    settings.nodeHeight +
    settings.bottomPadding;

  return {
    nodes: map.nodes.map(
      (node) =>
        positioned.get(node.id) ?? {
          ...node,
          position: { x: settings.sidePadding, y: settings.topPadding },
        },
    ),
    edges: map.edges.map((edge) => ({ ...edge })),
    width,
    height,
  };
}

function tracePrimaryPath(map: CuriosityMap): CuriosityMapNode[] {
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  const root = map.nodes.find((node) => node.kind === "question");
  if (!root) return [];

  const path = [root];
  const visited = new Set([root.id]);
  let current = root;

  while (current.kind !== "reflection") {
    const next = map.edges
      .filter((edge) => edge.source === current.id)
      .map((edge) => nodeById.get(edge.target))
      .filter(
        (node): node is CuriosityMapNode =>
          node !== undefined && node.kind !== "next_question",
      )
      .sort((left, right) => left.id.localeCompare(right.id, "en-US"))[0];

    if (!next || visited.has(next.id)) break;
    path.push(next);
    visited.add(next.id);
    current = next;
  }

  return path;
}

/**
 * Creates the compact, deterministic overview used only for a canonical
 * completed journey. Unexpected graph shapes safely retain the layered layout
 * so partial and future maps never lose nodes.
 */
export function layoutFinalCuriosityMap(
  map: CuriosityMap,
): LayoutedCuriosityMap {
  const settings = FINAL_MAP_OVERVIEW_LAYOUT;
  const primaryPath = tracePrimaryPath(map);
  const nextQuestions = map.nodes
    .filter((node) => node.kind === "next_question")
    .sort((left, right) => left.id.localeCompare(right.id, "en-US"));

  if (
    map.nodes.length !== 9 ||
    primaryPath.length !== 6 ||
    primaryPath.at(-1)?.kind !== "reflection" ||
    nextQuestions.length !== 3
  ) {
    return layoutCuriosityMap(map);
  }

  const usableWidth =
    settings.width - settings.sidePadding * 2 - settings.nodeWidth;
  const columns = [
    settings.sidePadding,
    settings.sidePadding + usableWidth / 2,
    settings.sidePadding + usableWidth,
  ].map((value) => Math.round(value * 100) / 100);
  const rows = [0, 1, 2].map(
    (row) => settings.topPadding + row * settings.rowGap,
  );
  const primarySlots: Array<readonly [number, number]> = [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [1, 1],
    [0, 1],
  ];
  const positioned = new Map<string, LayoutedCuriosityMapNode>();

  primaryPath.forEach((node, index) => {
    const [column, row] = primarySlots[index];
    positioned.set(node.id, {
      ...node,
      position: { x: columns[column], y: rows[row] },
    });
  });
  nextQuestions.forEach((node, column) => {
    positioned.set(node.id, {
      ...node,
      position: { x: columns[column], y: rows[2] },
    });
  });

  return {
    nodes: map.nodes.map(
      (node) =>
        positioned.get(node.id) ?? {
          ...node,
          position: {
            x: settings.sidePadding,
            y: settings.topPadding,
          },
        },
    ),
    edges: map.edges.map((edge) => ({ ...edge })),
    width: settings.width,
    height: rows[2] + settings.nodeHeight + settings.bottomPadding,
  };
}
