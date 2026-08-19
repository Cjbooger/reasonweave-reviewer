import type { ExplorationRoute } from "@/types/curiosity";

export type RouteDiversityIssueCode =
  | "route_count"
  | "duplicate_id"
  | "duplicate_title"
  | "near_duplicate_title"
  | "duplicate_lens"
  | "duplicate_activity"
  | "missing_active_method";

export interface RouteDiversityIssue {
  code: RouteDiversityIssueCode;
  message: string;
  routeIds?: string[];
}

export interface RouteDiversityResult {
  valid: boolean;
  issues: RouteDiversityIssue[];
}

const ACTIVE_METHOD_TERMS = [
  "build",
  "causal",
  "compare",
  "create",
  "design",
  "diagram",
  "model",
  "proposal",
  "propose",
  "system",
  "test",
];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return intersection / union;
}

function duplicateGroups(
  routes: readonly ExplorationRoute[],
  valueFor: (route: ExplorationRoute) => string,
): string[][] {
  const groups = new Map<string, string[]>();

  for (const route of routes) {
    const value = normalize(valueFor(route));
    const routeIds = groups.get(value) ?? [];
    routeIds.push(route.id);
    groups.set(value, routeIds);
  }

  return [...groups.values()].filter((routeIds) => routeIds.length > 1);
}

/**
 * Validates product-level route diversity after structural schema validation.
 * Lenses are treated as methods, so all three must differ. Activity labels are
 * also checked to prevent a model from hiding duplicate methods behind titles.
 */
export function validateRouteDiversity(
  routes: readonly ExplorationRoute[],
): RouteDiversityResult {
  const issues: RouteDiversityIssue[] = [];

  if (routes.length !== 3) {
    issues.push({
      code: "route_count",
      message: `Expected exactly 3 routes; received ${routes.length}.`,
      routeIds: routes.map((route) => route.id),
    });
  }

  for (const routeIds of duplicateGroups(routes, (route) => route.id)) {
    issues.push({
      code: "duplicate_id",
      message: "Route IDs must be unique.",
      routeIds,
    });
  }

  for (const routeIds of duplicateGroups(routes, (route) => route.title)) {
    issues.push({
      code: "duplicate_title",
      message: "Route titles must be unique.",
      routeIds,
    });
  }

  for (let leftIndex = 0; leftIndex < routes.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < routes.length;
      rightIndex += 1
    ) {
      const left = routes[leftIndex];
      const right = routes[rightIndex];

      if (
        normalize(left.title) !== normalize(right.title) &&
        jaccardSimilarity(left.title, right.title) >= 0.75
      ) {
        issues.push({
          code: "near_duplicate_title",
          message: `Routes “${left.title}” and “${right.title}” are too similar.`,
          routeIds: [left.id, right.id],
        });
      }
    }
  }

  for (const routeIds of duplicateGroups(routes, (route) => route.lens)) {
    issues.push({
      code: "duplicate_lens",
      message: "Each route must use a distinct thinking lens.",
      routeIds,
    });
  }

  for (const routeIds of duplicateGroups(
    routes,
    (route) => route.activityType,
  )) {
    issues.push({
      code: "duplicate_activity",
      message: "Each route must use a distinct activity type.",
      routeIds,
    });
  }

  const hasActiveMethod = routes.some((route) => {
    if (["create", "compare", "systems"].includes(route.lens)) {
      return true;
    }

    const activity = normalize(route.activityType);
    return ACTIVE_METHOD_TERMS.some((term) => activity.includes(term));
  });

  if (!hasActiveMethod) {
    issues.push({
      code: "missing_active_method",
      message:
        "At least one route must involve creation, design, comparison, testing, or systems thinking.",
    });
  }

  return { valid: issues.length === 0, issues };
}

export function hasRouteDiversity(
  routes: readonly ExplorationRoute[],
): boolean {
  return validateRouteDiversity(routes).valid;
}

export function assertRouteDiversity(
  routes: readonly ExplorationRoute[],
): void {
  const result = validateRouteDiversity(routes);

  if (!result.valid) {
    throw new Error(result.issues.map((issue) => issue.message).join(" "));
  }
}
