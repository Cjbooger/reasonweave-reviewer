import { apiErrorResponse } from "@/lib/api-errors";
import { withGenerationPermit } from "@/lib/generation-guard";
import { moderateLearnerText, routeTextForModeration } from "@/lib/moderation";
import { generateQuest } from "@/lib/openai/generate-quest";
import {
  createRequestSignal,
  jsonResponse,
  parseJsonRequest,
} from "@/lib/request";
import { assertSafetyIdentifier } from "@/lib/safety";
import { questRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const signal = createRequestSignal(request.signal);
    const input = await parseJsonRequest(request, questRequestSchema, signal);
    assertSafetyIdentifier(input.safetyIdentifier);
    return await withGenerationPermit(input.safetyIdentifier, async () => {
      await moderateLearnerText(
        [input.question, ...routeTextForModeration(input.selectedRoute)],
        signal,
      );
      return jsonResponse(await generateQuest(input, signal));
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
