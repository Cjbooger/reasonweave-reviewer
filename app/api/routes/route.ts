import { apiErrorResponse } from "@/lib/api-errors";
import { withGenerationPermit } from "@/lib/generation-guard";
import { moderateLearnerText } from "@/lib/moderation";
import { generateRoutes } from "@/lib/openai/generate-routes";
import {
  createRequestSignal,
  jsonResponse,
  parseJsonRequest,
} from "@/lib/request";
import { assertSafetyIdentifier } from "@/lib/safety";
import { routesRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const signal = createRequestSignal(request.signal);
    const input = await parseJsonRequest(request, routesRequestSchema, signal);
    assertSafetyIdentifier(input.safetyIdentifier);
    return await withGenerationPermit(input.safetyIdentifier, async () => {
      await moderateLearnerText([input.question], signal);
      return jsonResponse(await generateRoutes(input, signal));
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
