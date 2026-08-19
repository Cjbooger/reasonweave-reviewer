import { apiErrorResponse } from "@/lib/api-errors";
import { withGenerationPermit } from "@/lib/generation-guard";
import { moderateLearnerText, routeTextForModeration } from "@/lib/moderation";
import { generateReflection } from "@/lib/openai/generate-reflection";
import {
  createRequestSignal,
  jsonResponse,
  parseJsonRequest,
} from "@/lib/request";
import { assertSafetyIdentifier } from "@/lib/safety";
import { reflectRequestSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const signal = createRequestSignal(request.signal);
    const input = await parseJsonRequest(request, reflectRequestSchema, signal);
    assertSafetyIdentifier(input.safetyIdentifier);
    return await withGenerationPermit(input.safetyIdentifier, async () => {
      await moderateLearnerText(
        [
          input.question,
          ...routeTextForModeration(input.route),
          input.prediction,
          input.evidence.conciseExplanation,
          ...input.evidence.items.map((item) => item.statement),
          ...input.evidence.sources.map((source) => source.title),
          ...input.evidence.sources.map((source) => source.domain),
          input.evidenceDecision.establishes,
          input.evidenceDecision.unresolved,
          input.evidenceDecision.impact,
          input.evidenceApplication.designChoice,
          input.artifact,
          input.reflection.usedToThink,
          input.reflection.nowThink,
          input.reflection.stillWonder,
        ],
        signal,
      );
      return jsonResponse(await generateReflection(input, signal));
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
