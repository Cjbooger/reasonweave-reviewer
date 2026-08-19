import { apiErrorResponse } from "@/lib/api-errors";
import { withGenerationPermit } from "@/lib/generation-guard";
import { moderateLearnerText, routeTextForModeration } from "@/lib/moderation";
import { generateEvidence } from "@/lib/openai/generate-evidence";
import {
  createRequestSignal,
  jsonResponse,
  parseJsonRequest,
} from "@/lib/request";
import { assertSafetyIdentifier } from "@/lib/safety";
import { evidenceRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const signal = createRequestSignal(request.signal);
    const input = await parseJsonRequest(
      request,
      evidenceRequestSchema,
      signal,
    );
    assertSafetyIdentifier(input.safetyIdentifier);
    return await withGenerationPermit(input.safetyIdentifier, async () => {
      await moderateLearnerText(
        [
          input.question,
          input.prediction,
          ...routeTextForModeration(input.selectedRoute),
        ],
        signal,
      );
      return jsonResponse(await generateEvidence(input, signal));
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
