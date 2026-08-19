"use client";

import { ListTree, RotateCcw, X } from "lucide-react";
import {
  Component,
  type CSSProperties,
  type ReactNode,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FINAL_MAP_OVERVIEW_LAYOUT,
  layoutCuriosityMap,
  layoutFinalCuriosityMap,
  type LayoutedCuriosityMapNode,
} from "@/lib/map-layout";
import { buildMapFallbackItems } from "@/lib/map-fallback";
import { buildCuriosityMap } from "@/lib/map";
import type {
  CuriosityMap,
  CuriosityMapNode,
  CuriositySession,
  MapNodeKind,
} from "@/types/curiosity";

interface CuriosityMapProps {
  session: CuriositySession;
  full?: boolean;
}

const PLACEHOLDERS: CuriosityMapNode[] = [
  { id: "route", kind: "route", label: "Chosen route" },
  { id: "prediction", kind: "prediction", label: "Your prediction" },
  { id: "evidence", kind: "evidence", label: "Evidence Lens" },
  { id: "creation", kind: "creation", label: "Your creation" },
  { id: "reflection", kind: "reflection", label: "Changed model" },
  {
    id: "next-question-1",
    kind: "next_question",
    label: "A stronger next question",
  },
  {
    id: "next-question-2",
    kind: "next_question",
    label: "A connected next question",
  },
  {
    id: "next-question-3",
    kind: "next_question",
    label: "A challenging next question",
  },
];

const KIND_LABELS: Record<MapNodeKind, string> = {
  question: "Starting question",
  route: "Selected route",
  prediction: "Prediction",
  evidence: "Evidence cluster",
  creation: "Creation",
  reflection: "Changed model",
  next_question: "Next question",
};

function kindLabel(
  node: Pick<CuriosityMapNode, "id" | "kind">,
  hasEvidenceDecision: boolean,
  selectedNextQuestionId?: CuriositySession["selectedNextQuestionId"],
): string {
  if (
    node.id === "evidence" &&
    node.kind === "evidence" &&
    hasEvidenceDecision
  ) {
    return "Evidence decision";
  }
  if (node.kind === "next_question" && node.id === selectedNextQuestionId) {
    return "My next question";
  }
  return KIND_LABELS[node.kind];
}

type MapRevealStyle = CSSProperties & {
  "--map-reveal-delay": string;
};

const revealStyle = (delay: number): MapRevealStyle => ({
  "--map-reveal-delay": `${delay}ms`,
});

const nodeRevealDelay = (index: number): number =>
  index < 6 ? 320 + index * 150 : 1270 + (index - 6) * 130;

const edgeRevealDelay = (index: number): number =>
  index < 5 ? 395 + index * 150 : 1170 + (index - 5) * 130;

function compactEdgePath(
  source: LayoutedCuriosityMapNode,
  target: LayoutedCuriosityMapNode,
): string {
  const { nodeWidth, nodeHeight } = FINAL_MAP_OVERVIEW_LAYOUT;
  const sourceCenterX = source.position.x + nodeWidth / 2;
  const sourceCenterY = source.position.y + nodeHeight / 2;
  const targetCenterX = target.position.x + nodeWidth / 2;
  const targetCenterY = target.position.y + nodeHeight / 2;
  const sameRow = Math.abs(sourceCenterY - targetCenterY) < 1;

  if (sameRow) {
    const movingRight = targetCenterX > sourceCenterX;
    const startX = movingRight
      ? source.position.x + nodeWidth
      : source.position.x;
    const endX = movingRight
      ? target.position.x
      : target.position.x + nodeWidth;
    const controlOffset = (endX - startX) / 4;
    return `M ${startX} ${sourceCenterY} C ${startX + controlOffset} ${sourceCenterY}, ${endX - controlOffset} ${targetCenterY}, ${endX} ${targetCenterY}`;
  }

  const horizontalDelta = targetCenterX - sourceCenterX;
  const startX =
    source.kind === "reflection" && target.kind === "next_question"
      ? sourceCenterX +
        Math.max(
          -nodeWidth * 0.22,
          Math.min(nodeWidth * 0.22, horizontalDelta * 0.08),
        )
      : sourceCenterX;
  const startY = source.position.y + nodeHeight;
  const endY = target.position.y;
  const bendY = startY + (endY - startY) / 2;
  return `M ${startX} ${startY} C ${startX} ${bendY}, ${targetCenterX} ${bendY}, ${targetCenterX} ${endY}`;
}

function layeredEdgePath(
  source: LayoutedCuriosityMapNode,
  target: LayoutedCuriosityMapNode,
): string {
  const sourceX = source.position.x + 27;
  const sourceY = source.position.y + 31;
  const targetX = target.position.x + 27;
  const targetY = target.position.y + 31;
  const bendY = sourceY + (targetY - sourceY) * 0.52;
  return `M ${sourceX} ${sourceY + 25} C ${sourceX} ${bendY}, ${targetX} ${bendY}, ${targetX} ${targetY - 25}`;
}

function buildVisualMap(session: CuriositySession): {
  map: CuriosityMap;
  placeholderIds: Set<string>;
} {
  const actual = buildCuriosityMap(session);
  if (session.step === "branch") {
    return { map: actual, placeholderIds: new Set() };
  }

  const nodes = [...actual.nodes];
  const edges = [...actual.edges];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const placeholderIds = new Set<string>();

  for (const placeholder of PLACEHOLDERS) {
    if (!nodeIds.has(placeholder.id)) {
      nodes.push(placeholder);
      nodeIds.add(placeholder.id);
      placeholderIds.add(placeholder.id);
    }
  }

  const edgePairs: Array<[string, string]> = [
    ["question", "route"],
    ["route", "prediction"],
    ["prediction", "evidence"],
    ["evidence", "creation"],
    ["creation", "reflection"],
    ["reflection", "next-question-1"],
    ["reflection", "next-question-2"],
    ["reflection", "next-question-3"],
  ];

  const edgeIds = new Set(edges.map((edge) => edge.id));
  for (const [source, target] of edgePairs) {
    const id = `${source}-to-${target}`;
    if (!edgeIds.has(id)) {
      edges.push({ id, source, target });
    }
  }

  return { map: { nodes, edges }, placeholderIds };
}

const FINAL_MAP_LABEL_MAXIMUM_WIDTH = 158;

function estimatedLabelWidth(value: string): number {
  return Array.from(value).reduce((width, character) => {
    if (/\s/u.test(character)) return width + 4.25;
    if (/[ilI1|]/u.test(character)) return width + 4.25;
    if (/[MW@%&]/u.test(character)) return width + 12.75;
    if (/[A-Z]/u.test(character)) return width + 9;
    if (/[mw]/u.test(character)) return width + 10;
    if (/[.,'`:;]/u.test(character)) return width + 3.5;
    if (/[-–—]/u.test(character)) return width + 8;
    if (/[0-9]/u.test(character)) return width + 7.5;
    if ((character.codePointAt(0) ?? 0) > 0x2ff) return width + 13;
    return width + 7.25;
  }, 0);
}

function ellipsizeLabelLine(
  value: string,
  maximum: number,
  maximumWidth?: number,
): string {
  let bounded = value.slice(0, Math.max(0, maximum - 1)).trimEnd();
  while (
    bounded &&
    maximumWidth !== undefined &&
    estimatedLabelWidth(`${bounded}…`) > maximumWidth
  ) {
    bounded = bounded.slice(0, -1).trimEnd();
  }
  return `${bounded}…`;
}

function wrapLabel(
  label: string,
  maximum = 24,
  maximumLines = 3,
  maximumWidth?: number,
): string[] {
  const unbrokenChunkMaximum = Math.min(maximum, 8);
  const fitsWidth = (value: string) =>
    maximumWidth === undefined || estimatedLabelWidth(value) <= maximumWidth;
  const words = label
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      if (word.length < maximum && fitsWidth(word)) {
        return [{ text: word, isolated: false }];
      }
      return Array.from(
        { length: Math.ceil(word.length / unbrokenChunkMaximum) },
        (_, index) =>
          ({
            text: word.slice(
              index * unbrokenChunkMaximum,
              (index + 1) * unbrokenChunkMaximum,
            ),
            isolated: true,
          }) as const,
      );
    });
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.isolated) {
      if (current) lines.push(current);
      lines.push(word.text);
      current = "";
      continue;
    }
    if (!current) {
      current = word.text;
      continue;
    }
    const candidate = `${current} ${word.text}`;
    if (candidate.length <= maximum && fitsWidth(candidate)) {
      current = candidate;
    } else {
      lines.push(current);
      current = word.text;
    }
  }
  if (current) lines.push(current);

  const lineLimit = Math.max(1, Math.floor(maximumLines));
  if (lines.length <= lineLimit) return lines;
  return [
    ...lines.slice(0, lineLimit - 1),
    ellipsizeLabelLine(lines[lineLimit - 1], maximum, maximumWidth),
  ];
}

function useFinalMapFocusHandoff(enabled: boolean) {
  const panelRef = useRef<HTMLElement>(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!enabled || attemptedRef.current) return;
    const panel = panelRef.current;
    if (!panel) return;

    attemptedRef.current = true;
    const activeElement = document.activeElement;
    if (
      activeElement &&
      activeElement !== document.body &&
      activeElement !== document.documentElement &&
      !activeElement.matches("[data-screen-title], #main-content")
    ) {
      return;
    }

    panel.scrollIntoView?.({ block: "start" });
    panel.focus({ preventScroll: true });
  }, [enabled]);

  return panelRef;
}

function InteractiveCuriosityMap({ session, full = false }: CuriosityMapProps) {
  const [mapViewOverride, setMapViewOverride] = useState<
    "map" | "outline" | null
  >(null);
  const [revealCycle, setRevealCycle] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const outlineButtonRef = useRef<HTMLButtonElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const isFinalReveal = full && session.step === "branch";
  const panelRef = useFinalMapFocusHandoff(isFinalReveal);
  const visual = useMemo(() => buildVisualMap(session), [session]);
  const layout = useMemo(() => {
    if (isFinalReveal) return layoutFinalCuriosityMap(visual.map);
    return layoutCuriosityMap(visual.map, {
      width: full ? 980 : 620,
      nodeWidth: full ? 208 : 164,
      nodeHeight: 68,
      rowGap: full ? 118 : 103,
      sidePadding: full ? 68 : 34,
      topPadding: 42,
      bottomPadding: 48,
    });
  }, [full, isFinalReveal, visual.map]);
  const isFinalOverview =
    isFinalReveal &&
    layout.width === FINAL_MAP_OVERVIEW_LAYOUT.width &&
    layout.nodes.length === 9;
  const nodeById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
  }, [full, layout.width, mapViewOverride, session.step]);

  const selectMapView = (nextView: "map" | "outline") => {
    setMapViewOverride(nextView);

    if (nextView === "map") {
      window.requestAnimationFrame(() => outlineButtonRef.current?.focus());
      return;
    }

    window.requestAnimationFrame(() => outlineRef.current?.focus());
  };

  return (
    <section
      className={`map-panel${full ? " map-panel-full" : ""}${isFinalReveal ? " map-panel-reveal" : ""}${isFinalOverview ? " map-panel-overview" : ""}`}
      data-reveal-cycle={isFinalReveal ? revealCycle : undefined}
      data-layout={isFinalOverview ? "final-overview" : "layered"}
      data-map-view={mapViewOverride ?? "responsive"}
      id="curiosity-map"
      ref={panelRef}
      aria-labelledby="curiosity-map-title"
      tabIndex={-1}
    >
      <div className="map-toolbar">
        <h2 className="map-title" id="curiosity-map-title">
          Curiosity Map
        </h2>
        <div className="map-toolbar-actions">
          {isFinalReveal ? (
            <button
              className="outline-button"
              type="button"
              onClick={() => setRevealCycle((cycle) => cycle + 1)}
            >
              <RotateCcw size={15} /> Replay trail
            </button>
          ) : null}
          {mapViewOverride === null ? (
            <>
              <button
                className="outline-button map-view-button map-view-responsive-desktop"
                type="button"
                aria-controls="curiosity-map-outline"
                onClick={() => selectMapView("outline")}
              >
                <ListTree size={16} /> View text outline
              </button>
              <button
                className="outline-button map-view-button map-view-responsive-mobile"
                type="button"
                aria-controls="curiosity-map-outline"
                onClick={() => selectMapView("map")}
              >
                <X size={16} /> View map
              </button>
            </>
          ) : (
            <button
              className="outline-button map-view-button"
              type="button"
              ref={outlineButtonRef}
              aria-label={
                mapViewOverride === "outline" ? "View map" : "View text outline"
              }
              aria-controls="curiosity-map-outline"
              onClick={() =>
                selectMapView(mapViewOverride === "outline" ? "map" : "outline")
              }
            >
              {mapViewOverride === "outline" ? (
                <X size={16} />
              ) : (
                <ListTree size={16} />
              )}
              {mapViewOverride === "outline" ? (
                "View map"
              ) : (
                <>
                  <span className="map-view-label-wide">View text outline</span>
                  <span className="map-view-label-compact" aria-hidden="true">
                    View outline
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div
        className="map-scroll"
        ref={scrollContainerRef}
        role="region"
        aria-label="Scrollable Curiosity Map graphic"
        tabIndex={0}
      >
        <ol className="sr-only" aria-label="Curiosity Map learner trace">
          {layout.nodes.map((node) => {
            const placeholder = visual.placeholderIds.has(node.id);
            const nodeKindLabel = kindLabel(
              node,
              Boolean(session.evidenceDecision),
              session.selectedNextQuestionId,
            );
            const detail = placeholder ? undefined : node.detail;
            const detailLabel =
              node.kind === "evidence"
                ? session.evidenceDecision
                  ? "Selected finding"
                  : "Evidence details"
                : "Details";

            return (
              <li key={node.id}>
                <strong>{nodeKindLabel}:</strong> {node.label}
                {placeholder ? " — not reached yet" : ""}
                {detail ? (
                  <span>
                    {" "}
                    <strong>{detailLabel}:</strong> {detail}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
        <svg
          className={`map-svg${isFinalOverview ? " map-svg-overview" : ""}`}
          key={isFinalReveal ? revealCycle : undefined}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{
            height: `${isFinalOverview ? layout.height : Math.max(layout.height, full ? 490 : 520)}px`,
          }}
          aria-hidden="true"
          focusable="false"
          preserveAspectRatio="xMidYMin meet"
        >
          <defs>
            <marker
              id="arrow-complete"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#d5e8e5" />
            </marker>
            <marker
              id="arrow-next"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#e96e45" />
            </marker>
          </defs>

          <g aria-hidden="true">
            {layout.edges.map((edge, edgeIndex) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);
              if (!source || !target) return null;
              const nextQuestion = target.kind === "next_question";
              const selectedNextQuestion =
                edge.target === session.selectedNextQuestionId;

              return (
                <g
                  className={isFinalReveal ? "map-edge-stage" : undefined}
                  key={edge.id}
                  style={
                    isFinalReveal
                      ? revealStyle(edgeRevealDelay(edgeIndex))
                      : undefined
                  }
                >
                  <path
                    className={`map-edge${nextQuestion ? " map-edge-next" : ""}${selectedNextQuestion ? " map-edge-selected" : ""}`}
                    d={
                      isFinalOverview
                        ? compactEdgePath(source, target)
                        : layeredEdgePath(source, target)
                    }
                  />
                </g>
              );
            })}
          </g>

          <g>
            {layout.nodes.map((node, index) => {
              const placeholder = visual.placeholderIds.has(node.id);
              const nodeKindLabel = kindLabel(
                node,
                Boolean(session.evidenceDecision),
                session.selectedNextQuestionId,
              );
              const evidenceDetail =
                node.kind === "evidence" && !placeholder
                  ? node.detail
                  : undefined;
              const evidenceDetailLabel = session.evidenceDecision
                ? "Selected finding"
                : "Evidence details";
              const accessibleLabel = `${nodeKindLabel}: ${node.label}${evidenceDetail ? `. ${evidenceDetailLabel}: ${evidenceDetail}` : ""}${placeholder ? ", not reached yet" : ""}`;
              const nextQuestion =
                node.kind === "next_question" && !placeholder;
              const selectedNextQuestion =
                node.id === session.selectedNextQuestionId;
              const x = node.position.x + 27;
              const textX = x + (isFinalOverview ? 31 : 36);
              const y =
                node.position.y +
                (isFinalOverview
                  ? FINAL_MAP_OVERVIEW_LAYOUT.nodeHeight / 2
                  : 31);
              const labelLines = wrapLabel(
                node.label,
                isFinalOverview ? 23 : full ? 28 : 22,
                isFinalOverview ? 5 : 3,
                isFinalOverview ? FINAL_MAP_LABEL_MAXIMUM_WIDTH : undefined,
              );

              return (
                <g
                  className={isFinalReveal ? "map-node-stage" : undefined}
                  key={node.id}
                  role="listitem"
                  aria-label={accessibleLabel}
                  style={
                    isFinalReveal
                      ? revealStyle(nodeRevealDelay(index))
                      : undefined
                  }
                >
                  <title>{accessibleLabel}</title>
                  {isFinalOverview ? (
                    <rect
                      className={`map-node-card${nextQuestion ? " map-node-card-next" : ""}${selectedNextQuestion ? " map-node-card-selected" : ""}`}
                      x={node.position.x}
                      y={node.position.y}
                      width={FINAL_MAP_OVERVIEW_LAYOUT.nodeWidth}
                      height={FINAL_MAP_OVERVIEW_LAYOUT.nodeHeight}
                      rx="14"
                    />
                  ) : null}
                  <circle
                    className={`map-node-circle${
                      placeholder
                        ? " map-node-placeholder"
                        : nextQuestion
                          ? " map-node-next"
                          : ""
                    }${selectedNextQuestion ? " map-node-selected" : ""}`}
                    cx={x}
                    cy={y}
                    r={isFinalOverview ? "19" : "24"}
                  />
                  <text className="map-node-index" x={x} y={y}>
                    {placeholder ? "·" : index + 1}
                  </text>
                  {isFinalOverview ? (
                    <text
                      className={`map-node-kind${nextQuestion ? " map-node-kind-next" : ""}${selectedNextQuestion ? " map-node-kind-selected" : ""}`}
                      x={textX}
                      y={node.position.y + 22}
                    >
                      {nodeKindLabel}
                    </text>
                  ) : null}
                  <text
                    className={`map-node-label${placeholder ? " map-node-label-muted" : ""}`}
                    x={textX}
                    y={
                      isFinalOverview
                        ? node.position.y + 42
                        : y - (labelLines.length - 1) * 8
                    }
                  >
                    {labelLines.map((line, lineIndex) => (
                      <tspan
                        x={textX}
                        dy={lineIndex === 0 ? 0 : 17}
                        key={`${lineIndex}-${line}`}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="map-legend" aria-hidden="true">
        <span className="legend-item">
          <span className="legend-dot" /> Reached
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-dot-next" /> New question
        </span>
        {session.selectedNextQuestionId ? (
          <span className="legend-item">
            <span className="legend-dot legend-dot-selected" /> My next question
          </span>
        ) : null}
        {visual.placeholderIds.size > 0 ? (
          <span className="legend-item">Dashed = ahead</span>
        ) : null}
      </div>

      <div
        className="map-outline"
        id="curiosity-map-outline"
        ref={outlineRef}
        role="region"
        aria-label="Curiosity Map text outline"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          selectMapView("map");
        }}
      >
        <ol>
          {layout.nodes.map((node) => {
            const placeholder = visual.placeholderIds.has(node.id);
            const nodeKindLabel = kindLabel(
              node,
              Boolean(session.evidenceDecision),
              session.selectedNextQuestionId,
            );
            const evidenceDetail =
              node.kind === "evidence" && !placeholder
                ? node.detail
                : undefined;
            const evidenceDetailLabel = session.evidenceDecision
              ? "Selected finding"
              : "Evidence details";

            return (
              <li key={node.id}>
                <strong>{nodeKindLabel}:</strong> {node.label}
                {placeholder ? " — not reached yet" : ""}
                {evidenceDetail ? (
                  <span className="map-outline-detail">
                    <strong>{evidenceDetailLabel}:</strong> {evidenceDetail}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function CuriosityMapTextFallback({
  session,
  full = false,
}: CuriosityMapProps) {
  const items = buildMapFallbackItems(session);
  const panelRef = useFinalMapFocusHandoff(full && session.step === "branch");

  return (
    <section
      className={`map-panel map-fallback-panel${full ? " map-panel-full" : ""}`}
      id="curiosity-map"
      ref={panelRef}
      aria-labelledby="curiosity-map-title"
      tabIndex={-1}
    >
      <div className="map-toolbar">
        <h2 className="map-title" id="curiosity-map-title">
          Curiosity Map
        </h2>
      </div>
      <div className="map-fallback-content">
        <p className="map-fallback-notice" role="status">
          The visual map could not be drawn, so ReasonWeave preserved your
          journey as a text outline.
        </p>
        <ol className="map-fallback-list">
          {items.map((item) => (
            <li
              className="map-fallback-item"
              data-reached={item.reached}
              key={item.id}
            >
              <span className="map-fallback-index" aria-hidden="true">
                {item.reached ? "✓" : "·"}
              </span>
              <span>
                <strong>
                  {kindLabel(
                    item,
                    Boolean(session.evidenceDecision),
                    session.selectedNextQuestionId,
                  )}
                  :
                </strong>{" "}
                {item.label}
                {item.reached ? "" : " — not reached yet"}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

interface CuriosityMapErrorBoundaryProps extends CuriosityMapProps {
  children: ReactNode;
}

class CuriosityMapErrorBoundary extends Component<
  CuriosityMapErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <CuriosityMapTextFallback
          session={this.props.session}
          full={this.props.full}
        />
      );
    }
    return this.props.children;
  }
}

export const CuriosityMapView = memo(function CuriosityMapView({
  session,
  full = false,
}: CuriosityMapProps) {
  return (
    <CuriosityMapErrorBoundary
      key={`${session.id}:${session.step}:${full ? "full" : "compact"}`}
      session={session}
      full={full}
    >
      <InteractiveCuriosityMap session={session} full={full} />
    </CuriosityMapErrorBoundary>
  );
});
