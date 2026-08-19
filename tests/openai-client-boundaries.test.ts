import { APIUserAbortError } from "openai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, normalizeApiError } from "@/lib/api-errors";
import {
  assertModelProseComplete,
  assertResponseModerationAllowed,
  requireParsedOutput,
  withModelOutputRetry,
} from "@/lib/openai/client";
import { createRequestSignal } from "@/lib/request";

describe("OpenAI request budgets", () => {
  it("combines browser cancellation with the server deadline", () => {
    const request = new AbortController();
    const combined = createRequestSignal(request.signal, 60_000);

    expect(combined.aborted).toBe(false);
    request.abort();
    expect(combined.aborted).toBe(true);
  });

  it("normalizes an SDK user abort as a retryable timeout", () => {
    const error = normalizeApiError(new APIUserAbortError());
    expect(error).toMatchObject({
      code: "OPENAI_TIMEOUT",
      status: 504,
      retryable: true,
    });
  });
});

describe("structured model-output retry", () => {
  it("retries one SDK schema parse failure and returns the valid result", async () => {
    let schemaError: unknown;
    try {
      z.string().parse(42);
    } catch (error) {
      schemaError = error;
    }
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(schemaError)
      .mockResolvedValueOnce("valid structured output");

    await expect(withModelOutputRetry(operation)).resolves.toBe(
      "valid structured output",
    );
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated provider or application errors", async () => {
    const error = new ApiError({
      code: "OPENAI_RATE_LIMITED",
      message: "Busy",
      status: 429,
      retryable: true,
    });
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(error);

    await expect(withModelOutputRetry(operation)).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not start a retry after the request budget is aborted", async () => {
    const controller = new AbortController();
    const operation = vi.fn<() => Promise<string>>().mockImplementation(() => {
      controller.abort();
      return Promise.reject(
        new ApiError({
          code: "INVALID_MODEL_RESPONSE",
          message: "Invalid",
          status: 502,
          retryable: true,
        }),
      );
    });

    await expect(
      withModelOutputRetry(operation, controller.signal),
    ).rejects.toMatchObject({ code: "OPENAI_TIMEOUT", status: 504 });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("model prose completeness", () => {
  it.each([
    "A complete sentence.",
    "Is this complete?\u201d",
    "This uses full-width punctuation。",
  ])("accepts complete prose: %s", (value) => {
    expect(() =>
      assertModelProseComplete([{ value, maxLength: 80 }]),
    ).not.toThrow();
  });

  it("rejects prose that saturates its model-schema limit", () => {
    const value = `${"A".repeat(19)}.`;

    expect(() => assertModelProseComplete([{ value, maxLength: 20 }])).toThrow(
      expect.objectContaining({
        code: "INVALID_MODEL_RESPONSE",
        retryable: true,
      }),
    );
  });

  it("rejects an unfinished phrase below its model-schema limit", () => {
    expect(() =>
      assertModelProseComplete([{ value: "Separate:", maxLength: 80 }]),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_MODEL_RESPONSE",
        retryable: true,
      }),
    );
  });
});

describe("moderated structured responses", () => {
  const allowedModeration = {
    categories: {},
    category_applied_input_types: {},
    category_scores: {},
    flagged: false,
    model: "omni-moderation-latest",
    type: "moderation_result" as const,
  };

  it("fails closed when inline moderation is absent or errors", () => {
    expect(() => assertResponseModerationAllowed({})).toThrow(
      expect.objectContaining({ code: "OPENAI_UNAVAILABLE" }),
    );
    expect(() =>
      assertResponseModerationAllowed({
        moderation: {
          input: allowedModeration,
          output: { type: "error", code: "moderation_failed", message: "" },
        },
      }),
    ).toThrow(expect.objectContaining({ code: "OPENAI_UNAVAILABLE" }));
  });

  it("rejects a flagged input or output before returning parsed content", () => {
    expect(() =>
      assertResponseModerationAllowed({
        moderation: {
          input: allowedModeration,
          output: { ...allowedModeration, flagged: true },
        },
      }),
    ).toThrow(expect.objectContaining({ code: "CONTENT_BLOCKED" }));
  });

  it("distinguishes a refusal from an incomplete structured response", () => {
    const moderation = {
      input: allowedModeration,
      output: allowedModeration,
    };
    const refusal = {
      moderation,
      output_parsed: null,
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "Cannot help." }],
        },
      ],
    } as never;
    const incomplete = {
      moderation,
      output_parsed: null,
      output: [],
    } as never;

    expect(() => requireParsedOutput(refusal)).toThrow(
      expect.objectContaining({ code: "MODEL_REFUSAL" }),
    );
    expect(() => requireParsedOutput(incomplete)).toThrow(
      expect.objectContaining({ code: "INVALID_MODEL_RESPONSE" }),
    );
  });
});
