import type { QuestTimeBudget } from "@/lib/quest-time-budget";
import type { ExplorationRoute } from "@/types/curiosity";

const ROUTE_IMAGES = [
  "/images/routes/pressure-gauge-wonderlab.webp",
  "/images/routes/habitat-cutaway-wonderlab.webp",
  "/images/routes/ocean-ecosystem-wonderlab.webp",
] as const;

export function timeBudgetAccessibleName(budget: QuestTimeBudget): string {
  const allocation = (step: string, minutes: number) => {
    const wholeMinutes = Math.floor(minutes);
    const seconds = Math.round((minutes - wholeMinutes) * 60);
    if (wholeMinutes === 0) return `${step} ${seconds} seconds`;
    if (seconds === 0) {
      return `${step} ${wholeMinutes} ${wholeMinutes === 1 ? "minute" : "minutes"}`;
    }
    return `${step} ${wholeMinutes} ${wholeMinutes === 1 ? "minute" : "minutes"} and ${seconds} seconds`;
  };

  return `${budget.totalMinutes}-minute learner-work plan: ${[
    allocation("choose", budget.steps.choose),
    allocation("predict", budget.steps.predict),
    allocation("investigate", budget.steps.investigate),
    allocation("create", budget.steps.create),
    allocation("reflect", budget.steps.reflect),
    allocation("branch", budget.steps.branch),
  ].join(", ")}`;
}

export function compactTimeAllocation(minutes: number): string {
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  if (wholeMinutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${wholeMinutes}m`;
  return `${wholeMinutes}m ${seconds}s`;
}

export function clip(value: string, maximum: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maximum) return normalized;
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

export function formatLens(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function scrollBehavior(): ScrollBehavior {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export function routeImage(route: ExplorationRoute, index: number): string {
  const key = `${route.id} ${route.iconKey} ${route.lens}`.toLowerCase();
  if (key.includes("pressure") || key.includes("understand")) {
    return ROUTE_IMAGES[0];
  }
  if (
    key.includes("habitat") ||
    key.includes("design") ||
    key.includes("create")
  ) {
    return ROUTE_IMAGES[1];
  }
  if (
    key.includes("ocean") ||
    key.includes("reef") ||
    key.includes("challenge")
  ) {
    return ROUTE_IMAGES[2];
  }
  return ROUTE_IMAGES[index % ROUTE_IMAGES.length];
}
