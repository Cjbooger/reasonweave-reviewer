import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CuriosityMapView } from "@/components/curiosity-map";
import seededDemoJson from "@/data/demo-underwater.json";
import { buildCuriosityMap } from "@/lib/map";
import { seededDemoSessionSchema } from "@/lib/schemas";

const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoViewDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

describe("Curiosity Map presentation", () => {
  it("focuses a delayed completed Branch map once when its real panel mounts", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const { container, rerender } = render(
      <>
        <h1 data-screen-title tabIndex={-1}>
          Your question became a visible reasoning trace.
        </h1>
        <div role="status">Drawing your Curiosity Map…</div>
      </>,
    );
    const branchTitle = screen.getByRole("heading", {
      name: "Your question became a visible reasoning trace.",
    });
    branchTitle.focus();

    expect(container.querySelector("#curiosity-map")).not.toBeInTheDocument();
    expect(branchTitle).toHaveFocus();

    rerender(
      <>
        <h1 data-screen-title tabIndex={-1}>
          Your question became a visible reasoning trace.
        </h1>
        <CuriosityMapView session={session} full />
      </>,
    );

    const panel = container.querySelector<HTMLElement>("#curiosity-map");
    expect(panel).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });

    const replay = screen.getByRole("button", { name: "Replay trail" });
    replay.focus();
    rerender(
      <>
        <h1 data-screen-title tabIndex={-1}>
          Your question became a visible reasoning trace.
        </h1>
        <CuriosityMapView
          session={{
            ...session,
            selectedNextQuestionId: "next-question-2",
            updatedAt: "2026-07-18T12:10:00.000Z",
          }}
          full
        />
      </>,
    );

    expect(replay).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it("hands focus off from the skip-link main landmark when the delayed map mounts", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const { container, rerender } = render(
      <main id="main-content" tabIndex={-1}>
        <div role="status">Drawing your Curiosity Map…</div>
      </main>,
    );
    const main = container.querySelector<HTMLElement>("#main-content");
    main?.focus();
    expect(main).toHaveFocus();

    rerender(
      <main id="main-content" tabIndex={-1}>
        <CuriosityMapView session={session} full />
      </main>,
    );

    expect(container.querySelector("#curiosity-map")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it("reveals a completed map with concise labels from the learner's work", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const map = buildCuriosityMap(session);
    const { container } = render(<CuriosityMapView session={session} full />);

    expect(map.nodes).toHaveLength(9);
    expect(map.edges).toHaveLength(8);
    expect(
      map.edges.find((edge) => edge.target === session.selectedNextQuestionId)
        ?.label,
    ).toBe("I’ll explore next");
    const panel = container.querySelector(".map-panel-full");
    expect(panel).toHaveClass("map-panel-reveal");
    expect(panel).toHaveClass("map-panel-overview");
    expect(panel).toHaveAttribute("data-layout", "final-overview");
    expect(container.querySelectorAll(".map-node-stage")).toHaveLength(9);
    expect(container.querySelectorAll(".map-edge-stage")).toHaveLength(8);
    expect(container.querySelectorAll(".map-node-card")).toHaveLength(9);
    expect(container.querySelectorAll(".map-node-kind")).toHaveLength(9);
    const overview = container.querySelector(".map-svg-overview");
    expect(overview).toHaveAttribute("viewBox", "0 0 860 489");
    expect(overview).toHaveStyle({ height: "489px" });
    expect(overview).toHaveAttribute("aria-hidden", "true");
    expect(overview).toHaveAttribute("focusable", "false");

    const paths = [...container.querySelectorAll<SVGPathElement>(".map-edge")];
    expect(paths).toHaveLength(8);
    expect(paths[0]).toHaveAttribute(
      "d",
      "M 248 82.5 C 265.5 82.5, 300.5 82.5, 318 82.5",
    );
    expect(
      paths.every((path) => !path.getAttribute("d")?.includes("NaN")),
    ).toBe(true);

    const renderedLabels = [
      ...container.querySelectorAll<SVGTextElement>(".map-node-label"),
    ];
    expect(renderedLabels).toHaveLength(map.nodes.length);
    renderedLabels.forEach((label, index) => {
      const lines = [...label.querySelectorAll("tspan")].map(
        (line) => line.textContent ?? "",
      );
      expect(lines.length).toBeLessThanOrEqual(5);
      expect(lines.join(" ")).toBe(map.nodes[index].label);
    });

    const learnerTrace = screen.getByRole("list", {
      name: "Curiosity Map learner trace",
    });
    expect(learnerTrace).toHaveClass("sr-only");
    expect(overview).not.toContainElement(learnerTrace);
    const traceItems = within(learnerTrace).getAllByRole("listitem");
    expect(traceItems).toHaveLength(map.nodes.length);
    map.nodes.forEach((node, index) => {
      expect(traceItems[index]).toHaveTextContent(node.label);
      if (node.detail) {
        expect(traceItems[index]).toHaveTextContent(node.detail);
      }
    });
    const prefixNodes = [
      {
        id: "prediction",
        kindLabel: "Prediction",
        source: session.prediction!,
      },
      {
        id: "creation",
        kindLabel: "Creation",
        source: session.evidenceApplication!.designChoice,
      },
    ] as const;

    for (const { id, kindLabel, source } of prefixNodes) {
      const node = map.nodes.find((candidate) => candidate.id === id)!;
      expect(node.label.length).toBeLessThanOrEqual(78);
      expect(
        source.replace(/\s+/g, " ").startsWith(node.label.replace(/…$/, "")),
      ).toBe(true);
      expect(learnerTrace).toHaveTextContent(`${kindLabel}: ${node.label}`);
    }

    expect(map.nodes.find((node) => node.id === "prediction")?.label).not.toBe(
      "Initial prediction",
    );
    expect(map.nodes.find((node) => node.id === "evidence")?.label).not.toBe(
      "Evidence Lens",
    );
    const evidenceNode = map.nodes.find((node) => node.id === "evidence")!;
    expect(evidenceNode.label).toBe(
      "Complicates — Source boundary: A 100-person habitat's safety and independence",
    );
    expect(evidenceNode.label).toContain("Complicates");
    expect(evidenceNode.label).toContain("A 100-person");
    expect(evidenceNode.label).toContain("safety and independence");
    expect(evidenceNode.detail).toContain(
      "FIU's Aquarius lab supports up to six crew",
    );
    expect(learnerTrace).toHaveTextContent(
      `Evidence decision: ${evidenceNode.label}`,
    );
    expect(learnerTrace).toHaveTextContent(
      `Selected finding: ${evidenceNode.detail}`,
    );
    expect(container.querySelectorAll(".map-node-kind")[3]).toHaveTextContent(
      "Evidence decision",
    );
    const reflectionNode = map.nodes.find((node) => node.id === "reflection")!;
    expect(reflectionNode.label).toBe(
      "Maintenance, food, and redundant life support may be… depends on the others",
    );
    expect(reflectionNode.label).toContain(
      "Maintenance, food, and redundant life support",
    );
    expect(reflectionNode.label).not.toContain("At first");
    expect(reflectionNode.detail).toBe(
      session.reflectionResult!.changedThinking,
    );
    expect(learnerTrace).toHaveTextContent(
      `Changed model: ${reflectionNode.label}`,
    );
    expect(map.nodes.find((node) => node.id === "creation")?.label).not.toBe(
      "Learner creation",
    );
    expect(map.nodes.find((node) => node.id === "reflection")?.label).not.toBe(
      "Changed model",
    );

    const firstNode = container.querySelector<SVGGElement>(".map-node-stage");
    const lastNode =
      container.querySelectorAll<SVGGElement>(".map-node-stage")[8];
    expect(firstNode?.style.getPropertyValue("--map-reveal-delay")).toBe(
      "320ms",
    );
    expect(lastNode.style.getPropertyValue("--map-reveal-delay")).toBe(
      "1530ms",
    );

    expect(panel).toHaveAttribute("data-reveal-cycle", "0");
    fireEvent.click(screen.getByRole("button", { name: "Replay trail" }));
    expect(panel).toHaveAttribute("data-reveal-cycle", "1");
    expect(container.querySelectorAll(".map-node-stage")).toHaveLength(9);

    fireEvent.click(screen.getByRole("button", { name: "View text outline" }));
    const outline = container.querySelector(".map-outline");
    expect(outline?.querySelectorAll("li")).toHaveLength(9);
    for (const { id } of [
      ...prefixNodes,
      { id: "evidence" },
      { id: "reflection" },
    ]) {
      expect(outline).toHaveTextContent(
        map.nodes.find((node) => node.id === id)?.label ?? "",
      );
    }
    const evidenceOutlineItem = [...outline!.querySelectorAll("li")].find(
      (item) => item.textContent?.includes(evidenceNode.label),
    );
    expect(evidenceOutlineItem).toHaveTextContent(
      `Selected finding: ${evidenceNode.detail}`,
    );
    expect(evidenceOutlineItem).toHaveTextContent("Evidence decision:");
  });

  it("turns a negated source claim into a concise unresolved map insight", () => {
    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const map = buildCuriosityMap({
      ...session,
      evidenceDecision: {
        ...session.evidenceDecision!,
        unresolved:
          "The finding does not establish that 100 people could live independently for years.",
      },
    });
    const evidenceNode = map.nodes.find((node) => node.id === "evidence")!;

    expect(evidenceNode.label).toContain(
      "Complicates — Source boundary: 100 people could live independently for years",
    );
    expect(evidenceNode.label).toContain("independently for years");
    expect(evidenceNode.label).not.toContain("the finding does not");
    expect(evidenceNode.label).not.toContain("pressure-first prediction");
    expect(evidenceNode.label.length).toBeLessThanOrEqual(78);
  });

  it("updates the selected next question without remounting or replaying the final map", () => {
    const selected = seededDemoSessionSchema.parse(seededDemoJson);
    const unselected = {
      ...selected,
      selectedNextQuestionId: undefined,
      updatedAt: "2026-07-16T12:09:00.000Z",
    };
    const { container, rerender } = render(
      <CuriosityMapView session={unselected} full />,
    );
    const panelBefore = container.querySelector(".map-panel-full");
    const svgBefore = container.querySelector(".map-svg");
    fireEvent.click(screen.getByRole("button", { name: "Replay trail" }));
    expect(panelBefore).toHaveAttribute("data-reveal-cycle", "1");
    const svgAfterReplay = container.querySelector(".map-svg");
    expect(svgAfterReplay).not.toBe(svgBefore);

    rerender(<CuriosityMapView session={selected} full />);

    expect(container.querySelector(".map-panel-full")).toBe(panelBefore);
    expect(container.querySelector(".map-svg")).toBe(svgAfterReplay);
    expect(panelBefore).toHaveAttribute("data-reveal-cycle", "1");
    expect(
      screen.getByRole("list", { name: "Curiosity Map learner trace" }),
    ).toHaveTextContent(
      `My next question: ${selected.reflectionResult!.newQuestions[2]}`,
    );
  });

  it("keeps generic future labels and skips reveal motion before Branch", () => {
    const complete = seededDemoSessionSchema.parse(seededDemoJson);
    const session = {
      ...complete,
      prediction: undefined,
      evidence: undefined,
      evidenceDecision: undefined,
      artifact: undefined,
      reflectionInput: undefined,
      reflectionResult: undefined,
      map: undefined,
      step: "predict" as const,
    };
    const { container } = render(<CuriosityMapView session={session} full />);
    const learnerTrace = screen.getByRole("list", {
      name: "Curiosity Map learner trace",
    });

    expect(container.querySelector(".map-panel-full")).not.toHaveClass(
      "map-panel-reveal",
    );
    expect(container.querySelector(".map-panel-full")).toHaveAttribute(
      "data-layout",
      "layered",
    );
    expect(container.querySelectorAll(".map-node-stage")).toHaveLength(0);
    expect(container.querySelectorAll(".map-node-card")).toHaveLength(0);
    expect(document.activeElement).toBe(document.body);
    expect(learnerTrace).toHaveTextContent(
      "Prediction: Your prediction — not reached yet",
    );
    expect(learnerTrace).toHaveTextContent(
      "Evidence cluster: Evidence Lens — not reached yet",
    );
    expect(learnerTrace).toHaveTextContent(
      "Creation: Your creation — not reached yet",
    );
    expect(learnerTrace).toHaveTextContent(
      "Changed model: Changed model — not reached yet",
    );
  });

  it("keeps Evidence cluster until the learner makes an evidence decision", () => {
    const complete = seededDemoSessionSchema.parse(seededDemoJson);
    const session = {
      ...complete,
      evidenceDecision: undefined,
      artifact: undefined,
      reflectionInput: undefined,
      reflectionResult: undefined,
      map: undefined,
      step: "create" as const,
    };

    render(<CuriosityMapView session={session} full />);

    const evidenceNode = buildCuriosityMap(session).nodes.find(
      (node) => node.id === "evidence",
    )!;
    const learnerTrace = screen.getByRole("list", {
      name: "Curiosity Map learner trace",
    });
    expect(learnerTrace).toHaveTextContent(
      `Evidence cluster: ${evidenceNode.label}`,
    );
    expect(learnerTrace).toHaveTextContent(
      `Evidence details: ${evidenceNode.detail}`,
    );
    expect(learnerTrace).not.toHaveTextContent("Evidence decision:");

    fireEvent.click(screen.getByRole("button", { name: "View text outline" }));
    const outline = document.querySelector(".map-outline");
    const evidenceOutlineItem = [...outline!.querySelectorAll("li")].find(
      (item) => item.textContent?.includes(evidenceNode.label),
    );
    expect(evidenceOutlineItem).toHaveTextContent(
      `Evidence details: ${evidenceNode.detail}`,
    );
    expect(evidenceOutlineItem).not.toHaveTextContent("Selected finding:");
  });

  it("renders both CSS-responsive first-paint views and preserves a learner's map override", () => {
    let focusFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      focusFrame = callback;
      return 0;
    });

    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const { container } = render(<CuriosityMapView session={session} full />);

    const panel = container.querySelector(".map-panel");
    const mobileAction = screen.getByRole("button", { name: "View map" });
    const graphic = container.querySelector(".map-scroll");
    expect(panel).toHaveAttribute("data-map-view", "responsive");
    expect(
      screen.getByRole("button", { name: "View text outline" }),
    ).toHaveClass("map-view-responsive-desktop");
    expect(mobileAction).toHaveClass("map-view-responsive-mobile");
    expect(container.querySelector(".map-outline")).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(graphic).toHaveAttribute("tabindex", "0");
    expect(panel).toHaveFocus();

    fireEvent.click(mobileAction);
    focusFrame?.(0);

    const mapOverrideAction = screen.getByRole("button", {
      name: "View text outline",
    });
    expect(panel).toHaveAttribute("data-map-view", "map");
    expect(container.querySelector(".map-outline")).toBeInTheDocument();
    expect(graphic).toHaveAttribute("tabindex", "0");
    expect(document.activeElement).toBe(mapOverrideAction);
  });

  it("uses CSS instead of a hydration-time media query and returns focus when changing views", () => {
    const matchMedia = vi.fn();
    let focusFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("matchMedia", matchMedia);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      focusFrame = callback;
      return 0;
    });

    const session = seededDemoSessionSchema.parse(seededDemoJson);
    const { container } = render(<CuriosityMapView session={session} full />);
    const panel = container.querySelector(".map-panel");

    fireEvent.click(screen.getByRole("button", { name: "View text outline" }));
    focusFrame?.(0);

    const outline = container.querySelector(".map-outline");
    expect(matchMedia).not.toHaveBeenCalled();
    expect(panel).toHaveAttribute("data-map-view", "outline");
    expect(outline).toHaveFocus();

    fireEvent.keyDown(outline!, { key: "Escape" });
    focusFrame?.(0);

    const mapAction = screen.getByRole("button", {
      name: "View text outline",
    });
    expect(panel).toHaveAttribute("data-map-view", "map");
    expect(container.querySelector(".map-outline")).toBeInTheDocument();
    expect(mapAction).toHaveFocus();
  });
});
