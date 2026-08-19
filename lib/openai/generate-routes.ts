import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { hasRouteDiversity } from "@/lib/route-diversity";
import { explorationRouteSchema, routesResponseSchema } from "@/lib/schemas";
import {
  assertBrowserSafeActivity,
  assertSafetyIdentifier,
} from "@/lib/safety";
import type { RoutesRequest, RoutesResponse } from "@/types/curiosity";

import {
  getOpenAIClient,
  getOpenAIModel,
  parseModelResult,
  requireParsedOutput,
  responseDefaults,
  responseTextDefaults,
  withModelOutputRetry,
} from "./client";
import { buildRoutesPrompt, REASONWEAVE_SYSTEM_PROMPT } from "./prompts";

const modelRouteSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(3).max(48),
  hook: z.string().min(12).max(140),
  lens: z.enum(["understand", "challenge", "create", "compare", "systems"]),
  activityType: z.string().min(3).max(60),
  estimatedMinutes: z.number().int().min(3).max(15),
  iconKey: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/),
});

const modelRoutesSchema = z.object({
  routes: z.array(modelRouteSchema).length(3),
});

export function routesAreDiverse(
  routes: readonly z.infer<typeof modelRouteSchema>[],
): boolean {
  return hasRouteDiversity(routes);
}

export async function generateRoutes(
  input: RoutesRequest,
  signal?: AbortSignal,
): Promise<RoutesResponse> {
  assertSafetyIdentifier(input.safetyIdentifier);

  return withModelOutputRetry(async () => {
    const response = await getOpenAIClient().responses.parse(
      {
        model: getOpenAIModel(),
        instructions: REASONWEAVE_SYSTEM_PROMPT,
        input: buildRoutesPrompt(input),
        text: {
          ...responseTextDefaults,
          format: zodTextFormat(modelRoutesSchema, "wonderlab_routes"),
        },
        max_output_tokens: 1_800,
        safety_identifier: input.safetyIdentifier,
        ...responseDefaults,
      },
      { signal },
    );

    const parsed = requireParsedOutput(response);
    const routes = parsed.routes.map((route) =>
      parseModelResult(explorationRouteSchema, {
        ...route,
        estimatedMinutes: input.durationMinutes,
      }),
    );

    const result = parseModelResult(routesResponseSchema, { routes });
    assertBrowserSafeActivity(
      result.routes.flatMap((route) => [
        route.title,
        route.hook,
        route.activityType,
      ]),
    );
    return result;
  }, signal);
}
