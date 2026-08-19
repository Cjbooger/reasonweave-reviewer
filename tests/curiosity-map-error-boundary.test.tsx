import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import seededDemoJson from "@/data/demo-underwater.json";
import { seededDemoSessionSchema } from "@/lib/schemas";

vi.mock("@/lib/map-layout", () => ({
  layoutCuriosityMap: () => {
    throw new Error("simulated layout failure");
  },
}));

import { CuriosityMapView } from "@/components/curiosity-map";

const originalScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

afterEach(() => {
  vi.restoreAllMocks();
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

describe("Curiosity Map failure recovery", () => {
  it("renders the independent text journey when visual layout throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const session = seededDemoSessionSchema.parse(seededDemoJson);

    render(<CuriosityMapView session={session} full />);

    expect(
      screen.getByText(/visual map could not be drawn/i),
    ).toBeInTheDocument();
    expect(screen.getByText(session.question)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(
      screen.getByText("Evidence decision:", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const fallback = document.querySelector<HTMLElement>(".map-fallback-panel");
    expect(fallback).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });
});
