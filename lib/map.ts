import { finalCuriosityMapSchema } from "@/lib/schemas";
import { conciseUnresolvedClaim } from "@/lib/evidence-decision";
import type {
  CuriosityMap,
  CuriosityMapEdge,
  CuriosityMapNode,
  CuriositySession,
  MapNodeKind,
} from "@/types/curiosity";

export type MapIntegrityIssueCode =
  | "too_many_nodes"
  | "duplicate_node"
  | "duplicate_edge"
  | "missing_source"
  | "missing_target"
  | "self_loop"
  | "cycle"
  | "disconnected";

export interface MapIntegrityIssue {
  code: MapIntegrityIssueCode;
  message: string;
  id?: string;
}

export interface MapIntegrityResult {
  valid: boolean;
  issues: MapIntegrityIssue[];
}

const truncate = (value: string, maximum: number): string => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
};

const learnerLabel = (value: string): string => truncate(value, 78);

function labelWithSemanticTail(
  value: string,
  maximum: number,
  tailWordCount: number,
): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maximum) return normalized;

  const words = normalized.split(" ");
  const tail = words.slice(-tailWordCount).join(" ");
  const headBudget = maximum - tail.length - 2;
  if (headBudget < 12) return truncate(normalized, maximum);

  const boundedHead = normalized.slice(0, headBudget).trimEnd();
  const lastSpace = boundedHead.lastIndexOf(" ");
  const head = boundedHead.slice(0, Math.max(lastSpace, 1)).trimEnd();
  return head ? `${head}… ${tail}` : truncate(normalized, maximum);
}

function evidenceDecisionLabel(
  decision: NonNullable<CuriositySession["evidenceDecision"]>,
): string {
  const unresolved = conciseUnresolvedClaim(decision.unresolved);
  const label = `${EVIDENCE_RELATIONSHIP_LABELS[decision.relationship]} — Source boundary: ${unresolved}`;
  return labelWithSemanticTail(label, 78, 3);
}

function revisedBeliefLabel(value: string): string {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /^(?:now\s*,?\s*)?i\s+(?:now\s+)?(?:think|believe|see|realize|understand)\s+(?:that\s+)?/i,
      "",
    )
    .replace(/[.!?…]+$/, "")
    .trim();
  const belief = normalized || value.trim().replace(/\s+/g, " ");
  const capitalized = `${belief.charAt(0).toLocaleUpperCase()}${belief.slice(1)}`;
  return labelWithSemanticTail(capitalized, 78, 4);
}

const EVIDENCE_RELATIONSHIP_LABELS = {
  supports: "Supports",
  challenges: "Challenges",
  complicates: "Complicates",
} as const;

const node = (
  id: string,
  kind: MapNodeKind,
  label: string,
  detail?: string,
): CuriosityMapNode => ({
  id,
  kind,
  label: truncate(label, 140),
  ...(detail ? { detail: truncate(detail, 500) } : {}),
});

const edge = (
  source: string,
  target: string,
  label?: string,
): CuriosityMapEdge => ({
  id: `${source}-to-${target}`,
  source,
  target,
  ...(label ? { label } : {}),
});

/**
 * Builds the finite semantic trace represented by the current session. It never
 * includes model-supplied coordinates or recursively expands next questions.
 */
export function buildCuriosityMap(session: CuriositySession): CuriosityMap {
  const nodes: CuriosityMapNode[] = [
    node("question", "question", session.question),
  ];
  const edges: CuriosityMapEdge[] = [];
  let previousNodeId = "question";

  const selectedRoute = session.routes.find(
    (route) => route.id === session.selectedRouteId,
  );
  if (selectedRoute) {
    nodes.push(node("route", "route", selectedRoute.title, selectedRoute.hook));
    edges.push(edge(previousNodeId, "route", "chose"));
    previousNodeId = "route";
  }

  if (session.prediction) {
    nodes.push(
      node(
        "prediction",
        "prediction",
        learnerLabel(session.prediction),
        session.prediction,
      ),
    );
    edges.push(edge(previousNodeId, "prediction", "predicted"));
    previousNodeId = "prediction";
  }

  if (session.evidence) {
    const selectedEvidence = session.evidenceDecision
      ? session.evidence.items.find(
          (item) => item.id === session.evidenceDecision?.evidenceItemId,
        )
      : undefined;
    const evidenceLabel = session.evidenceDecision
      ? evidenceDecisionLabel(session.evidenceDecision)
      : session.evidence.conciseExplanation;
    const evidenceDetail = selectedEvidence
      ? `${selectedEvidence.statement} Sources: ${selectedEvidence.sourceIds
          .map((sourceId) =>
            session.evidence?.sources.find((source) => source.id === sourceId),
          )
          .filter((source) => source !== undefined)
          .map((source) => `${source.title} (${source.domain})`)
          .join(", ")}.`
      : session.evidence.items
          .map((item) => `${item.kind.replace("_", " ")}: ${item.statement}`)
          .join(" • ");
    nodes.push(
      node("evidence", "evidence", learnerLabel(evidenceLabel), evidenceDetail),
    );
    edges.push(edge(previousNodeId, "evidence", "investigated"));
    previousNodeId = "evidence";
  }

  if (session.artifact) {
    const creationLabel =
      session.evidenceApplication?.designChoice ?? session.artifact;
    const artifactAnchor =
      session.evidenceApplication?.artifactAnchor?.trim() || undefined;
    const creationDetail = session.evidenceApplication
      ? `Evidence-to-design link: ${session.evidenceApplication.designChoice}${
          artifactAnchor ? ` Creation anchor: “${artifactAnchor}”.` : ""
        } Learner creation: ${session.artifact}`
      : session.artifact;
    nodes.push(
      node("creation", "creation", learnerLabel(creationLabel), creationDetail),
    );
    edges.push(
      edge(
        previousNodeId,
        "creation",
        session.evidenceApplication ? "applied evidence" : "created",
      ),
    );
    previousNodeId = "creation";
  }

  if (session.reflectionInput && session.reflectionResult) {
    nodes.push(
      node(
        "reflection",
        "reflection",
        revisedBeliefLabel(session.reflectionInput.nowThink),
        session.reflectionResult.changedThinking,
      ),
    );
    edges.push(edge(previousNodeId, "reflection", "reflected"));
    previousNodeId = "reflection";

    session.reflectionResult.newQuestions.forEach((question, index) => {
      const nextQuestionId = `next-question-${index + 1}`;
      nodes.push(node(nextQuestionId, "next_question", question));
      edges.push(
        edge(
          previousNodeId,
          nextQuestionId,
          session.selectedNextQuestionId === nextQuestionId
            ? "I’ll explore next"
            : "still wonders",
        ),
      );
    });
  }

  return { nodes, edges };
}

/** Builds and validates the canonical nine-node completed map. */
export function buildFinalCuriosityMap(
  session: CuriositySession,
): CuriosityMap {
  const required: Array<[string, unknown]> = [
    ["selected route", session.selectedRouteId],
    ["quest plan", session.quest],
    ["prediction", session.prediction],
    ["evidence", session.evidence],
    ["evidence decision", session.evidenceDecision],
    ["evidence-to-design link", session.evidenceApplication],
    ["artifact", session.artifact],
    ["reflection input", session.reflectionInput],
    ["reflection result", session.reflectionResult],
  ];
  const missing = required
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Cannot build a final Curiosity Map without: ${missing.join(", ")}.`,
    );
  }

  const map = buildCuriosityMap(session);
  return finalCuriosityMapSchema.parse(map);
}

export function validateMapIntegrity(map: CuriosityMap): MapIntegrityResult {
  const issues: MapIntegrityIssue[] = [];

  if (map.nodes.length > 10) {
    issues.push({
      code: "too_many_nodes",
      message: `Curiosity Maps are finite and may contain at most 10 nodes; received ${map.nodes.length}.`,
    });
  }

  const nodeIds = new Set<string>();
  for (const mapNode of map.nodes) {
    if (nodeIds.has(mapNode.id)) {
      issues.push({
        code: "duplicate_node",
        message: `Duplicate map node ID “${mapNode.id}”.`,
        id: mapNode.id,
      });
    }
    nodeIds.add(mapNode.id);
  }

  const edgeIds = new Set<string>();
  for (const mapEdge of map.edges) {
    if (edgeIds.has(mapEdge.id)) {
      issues.push({
        code: "duplicate_edge",
        message: `Duplicate map edge ID “${mapEdge.id}”.`,
        id: mapEdge.id,
      });
    }
    edgeIds.add(mapEdge.id);

    if (!nodeIds.has(mapEdge.source)) {
      issues.push({
        code: "missing_source",
        message: `Edge “${mapEdge.id}” references missing source “${mapEdge.source}”.`,
        id: mapEdge.id,
      });
    }
    if (!nodeIds.has(mapEdge.target)) {
      issues.push({
        code: "missing_target",
        message: `Edge “${mapEdge.id}” references missing target “${mapEdge.target}”.`,
        id: mapEdge.id,
      });
    }
    if (mapEdge.source === mapEdge.target) {
      issues.push({
        code: "self_loop",
        message: `Edge “${mapEdge.id}” creates a self-loop.`,
        id: mapEdge.id,
      });
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const mapNode of map.nodes) adjacency.set(mapNode.id, []);
  for (const mapEdge of map.edges) {
    if (nodeIds.has(mapEdge.source) && nodeIds.has(mapEdge.target)) {
      adjacency.get(mapEdge.source)?.push(mapEdge.target);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    for (const childId of adjacency.get(nodeId) ?? []) {
      if (visit(childId)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const mapNode of map.nodes) {
    if (visit(mapNode.id)) {
      issues.push({
        code: "cycle",
        message: "Curiosity Maps cannot recursively expand or contain cycles.",
      });
      break;
    }
  }

  const root = map.nodes.find((mapNode) => mapNode.kind === "question");
  if (root) {
    const reachable = new Set<string>();
    const queue = [root.id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || reachable.has(current)) continue;
      reachable.add(current);
      queue.push(...(adjacency.get(current) ?? []));
    }

    if (reachable.size !== map.nodes.length) {
      issues.push({
        code: "disconnected",
        message: "Every map node must connect to the starting question.",
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

const OUTLINE_KIND_LABELS: Record<MapNodeKind, string> = {
  question: "Starting question",
  route: "Selected route",
  prediction: "Prediction",
  evidence: "Evidence cluster",
  creation: "Creation",
  reflection: "Changed model",
  next_question: "Next question",
};

const EVIDENCE_DECISION_PREFIXES = Object.values(
  EVIDENCE_RELATIONSHIP_LABELS,
).map((label) => `${label} —`);

function isEvidenceDecisionNode(mapNode: CuriosityMapNode): boolean {
  return (
    mapNode.kind === "evidence" &&
    EVIDENCE_DECISION_PREFIXES.some((prefix) =>
      mapNode.label.startsWith(prefix),
    )
  );
}

function outlineKindLabel(mapNode: CuriosityMapNode): string {
  if (isEvidenceDecisionNode(mapNode)) {
    return "Evidence decision";
  }
  return OUTLINE_KIND_LABELS[mapNode.kind];
}

function outlineDetail(mapNode: CuriosityMapNode): string {
  if (!mapNode.detail) return "";
  if (mapNode.kind !== "evidence") return ` — ${mapNode.detail}`;
  const label = isEvidenceDecisionNode(mapNode)
    ? "Selected finding"
    : "Evidence details";
  return ` — ${label}: ${mapNode.detail}`;
}

/** Accessible fallback when the visual graph cannot render. */
export function mapToTextOutline(map: CuriosityMap): string {
  const nodeById = new Map(map.nodes.map((mapNode) => [mapNode.id, mapNode]));
  const children = new Map<string, string[]>();
  for (const mapNode of map.nodes) children.set(mapNode.id, []);
  for (const mapEdge of map.edges) {
    children.get(mapEdge.source)?.push(mapEdge.target);
  }
  for (const childIds of children.values()) childIds.sort();

  const root = map.nodes.find((mapNode) => mapNode.kind === "question");
  if (!root) return "Curiosity Map unavailable.";

  const lines: string[] = [];
  const visited = new Set<string>();
  const walk = (nodeId: string, depth: number) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const mapNode = nodeById.get(nodeId);
    if (!mapNode) return;
    lines.push(
      `${"  ".repeat(depth)}- ${outlineKindLabel(mapNode)}: ${mapNode.label}${outlineDetail(mapNode)}`,
    );

    for (const childId of children.get(nodeId) ?? []) {
      walk(childId, depth + 1);
    }
  };

  walk(root.id, 0);
  return lines.join("\n");
}
