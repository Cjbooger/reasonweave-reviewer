import { ApiError } from "@/lib/api-errors";
import { getOpenAIClient } from "@/lib/openai/client";
import type { ExplorationRoute } from "@/types/curiosity";
import type { Moderation } from "openai/resources/moderations";

type ModerationResult = Pick<Moderation, "categories" | "flagged">;

const GENERIC_BLOCK_MESSAGE =
  "ReasonWeave cannot continue with that content. Try a safer, school-appropriate curiosity.";
const SUPPORTIVE_SAFETY_MESSAGE =
  "ReasonWeave cannot turn this into a quest. If this may involve immediate danger, contact local emergency services now and tell a trusted adult. If you can, stay with a safe person while you get help.";

export function routeTextForModeration(
  route: ExplorationRoute,
): readonly string[] {
  return [route.title, route.hook, route.activityType];
}

export function moderationBlockMessage(
  results: readonly ModerationResult[],
): string | undefined {
  const flagged = results.filter((result) => result.flagged);
  if (flagged.length === 0) return undefined;

  const selfHarm = flagged.some(
    (result) =>
      result.categories["self-harm"] ||
      result.categories["self-harm/intent"] ||
      result.categories["self-harm/instructions"],
  );
  return selfHarm ? SUPPORTIVE_SAFETY_MESSAGE : GENERIC_BLOCK_MESSAGE;
}

export async function moderateLearnerText(
  parts: readonly string[],
  signal?: AbortSignal,
): Promise<void> {
  const input = parts.map((part) => part.trim()).filter(Boolean);
  if (input.length === 0) {
    return;
  }

  const response = await getOpenAIClient().moderations.create(
    {
      model: "omni-moderation-latest",
      input,
    },
    { signal },
  );

  if (response.results.length !== input.length) {
    throw new ApiError({
      code: "OPENAI_UNAVAILABLE",
      message:
        "ReasonWeave could not complete its safety check. Try again or use the demo quest.",
      status: 503,
      retryable: true,
    });
  }

  const blockMessage = moderationBlockMessage(response.results);
  if (blockMessage) {
    throw new ApiError({
      code: "CONTENT_BLOCKED",
      message: blockMessage,
      status: 422,
    });
  }
}
