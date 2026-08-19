import "server-only";

import OpenAI from "openai";
import type {
  ParsedResponse,
  Response,
} from "openai/resources/responses/responses";
import { z } from "zod";

import { ApiError } from "@/lib/api-errors";
import {
  assertLiveGenerationEnabled,
  REQUIRED_OPENAI_MODEL,
} from "@/lib/live-generation";

const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const REQUEST_TIMEOUT_MS = 24_000;
const MAX_RETRIES = 0;

let client: OpenAI | undefined;

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || REQUIRED_OPENAI_MODEL;
}

export function getOpenAIClient(): OpenAI {
  assertLiveGenerationEnabled();

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError({
      code: "OPENAI_NOT_CONFIGURED",
      message:
        "Live generation is not configured yet. You can continue with the demo quest.",
      status: 503,
    });
  }

  client ??= new OpenAI({
    apiKey,
    baseURL: OPENAI_API_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    // Never allow OPENAI_LOG to turn learner prompts or responses into logs.
    logLevel: "off",
  });

  return client;
}

export function requireParsedOutput<T>(response: ParsedResponse<T>): T {
  assertResponseModerationAllowed(response);

  if (response.output_parsed !== null) {
    return response.output_parsed;
  }

  const refused = response.output.some(
    (output) =>
      output.type === "message" &&
      output.content.some((content) => content.type === "refusal"),
  );

  if (refused) {
    throw new ApiError({
      code: "MODEL_REFUSAL",
      message:
        "ReasonWeave could not create a safe quest for that request. Try a different curiosity.",
      status: 422,
    });
  }

  throw new ApiError({
    code: "INVALID_MODEL_RESPONSE",
    message:
      "The live quest arrived incomplete. Try again or use the demo quest.",
    status: 502,
    retryable: true,
  });
}

const COMPLETE_PROSE_END = /[.!?…。！？](?:["'”’)\]])*$/u;

/**
 * Reject user-facing prose that appears clipped or unfinished. Structured
 * output can satisfy a string maxLength by stopping exactly at the boundary,
 * so this guard runs after parsing and lets the existing bounded retry repair
 * the response without ever returning a broken sentence to the learner.
 */
export function assertModelProseComplete(
  fields: readonly { value: string; maxLength: number }[],
): void {
  const hasIncompleteField = fields.some(({ value, maxLength }) => {
    const normalized = value.trim();
    return (
      normalized.length >= maxLength || !COMPLETE_PROSE_END.test(normalized)
    );
  });

  if (hasIncompleteField) {
    throw new ApiError({
      code: "INVALID_MODEL_RESPONSE",
      message:
        "The live quest arrived incomplete. Try again or use the demo quest.",
      status: 502,
      retryable: true,
    });
  }
}

export function assertResponseModerationAllowed(response: {
  moderation?: Response["moderation"];
}): void {
  const moderation = response.moderation;
  if (!moderation) {
    throw new ApiError({
      code: "OPENAI_UNAVAILABLE",
      message:
        "ReasonWeave could not complete its safety check. Try again or use the demo quest.",
      status: 503,
      retryable: true,
    });
  }

  for (const result of [moderation.input, moderation.output]) {
    if (result.type === "error") {
      throw new ApiError({
        code: "OPENAI_UNAVAILABLE",
        message:
          "ReasonWeave could not complete its safety check. Try again or use the demo quest.",
        status: 503,
        retryable: true,
      });
    }

    if (result.flagged) {
      throw new ApiError({
        code: "CONTENT_BLOCKED",
        message:
          "ReasonWeave cannot continue with that content. Try a safer, school-appropriate curiosity.",
        status: 422,
      });
    }
  }
}

/** Retry once only when validated model output is malformed, unsafe, or missing required citation bindings. */
export async function withModelOutputRetry<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (caught) {
      const error =
        caught instanceof z.ZodError || caught instanceof SyntaxError
          ? new ApiError({
              code: "INVALID_MODEL_RESPONSE",
              message:
                "The live quest arrived in an unexpected format. Try again or use the demo quest.",
              status: 502,
              retryable: true,
              cause: caught,
            })
          : caught;

      if (signal?.aborted) {
        throw new ApiError({
          code: "OPENAI_TIMEOUT",
          message:
            "The live quest took too long to generate. Try again or use the demo quest.",
          status: 504,
          retryable: true,
          cause: error,
        });
      }

      const retryableOutput =
        error instanceof ApiError &&
        [
          "INVALID_MODEL_RESPONSE",
          "UNSAFE_ACTIVITY",
          "CITATIONS_UNAVAILABLE",
        ].includes(error.code);
      if (!retryableOutput || attempt === 1) throw error;
    }
  }

  throw new Error("Model output retry exhausted unexpectedly.");
}

export function parseModelResult<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError({
      code: "INVALID_MODEL_RESPONSE",
      message:
        "The live quest arrived in an unexpected format. Try again or use the demo quest.",
      status: 502,
      retryable: true,
      cause: result.error,
    });
  }

  return result.data;
}

export const responseDefaults = {
  moderation: { model: "omni-moderation-latest" as const },
  reasoning: { effort: "low" as const },
  service_tier: "default" as const,
  store: false as const,
};

export const responseTextDefaults = {
  // GPT-5.6 recommends setting the default detail level intentionally. These
  // schemas carry the required content; low verbosity keeps the quest UI fast
  // and concise without weakening any required field.
  verbosity: "low" as const,
};
