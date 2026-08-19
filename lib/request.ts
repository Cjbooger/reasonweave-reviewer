import { z } from "zod";

import { ApiError, type ApiErrorIssue } from "@/lib/api-errors";

const MAX_REQUEST_BYTES = 64 * 1024;
export const SERVER_REQUEST_BUDGET_MS = 28_000;

function requestTooLargeError(): ApiError {
  return new ApiError({
    code: "INVALID_REQUEST",
    message:
      "That request is too large. Shorten the learner responses and try again.",
    status: 413,
  });
}

async function readRequestBody(
  request: Request,
  signal: AbortSignal,
): Promise<string> {
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let rawBody = "";
  let receivedBytes = 0;
  let rejectOnAbort: ((reason: unknown) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = reject;
  });
  const onAbort = () => {
    const reason =
      signal.reason ??
      new DOMException("The request was aborted.", "AbortError");
    rejectOnAbort?.(reason);
    void reader.cancel(reason).catch(() => {
      // The abort reason still wins if transport cancellation fails.
    });
  };

  try {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });

    while (true) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_REQUEST_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the stable 413 response even if transport cancellation fails.
        }
        throw requestTooLargeError();
      }

      rawBody += decoder.decode(value, { stream: true });
    }

    return rawBody + decoder.decode();
  } finally {
    signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

export function createRequestSignal(
  requestSignal: AbortSignal,
  timeoutMs = SERVER_REQUEST_BUDGET_MS,
): AbortSignal {
  return AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)]);
}

export async function parseJsonRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
  signal: AbortSignal = request.signal,
): Promise<T> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError({
      code: "INVALID_REQUEST",
      message: "Send this request as JSON.",
      status: 415,
    });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw requestTooLargeError();
  }

  const rawBody = await readRequestBody(request, signal);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new ApiError({
      code: "INVALID_REQUEST",
      message: "The request body is not valid JSON.",
      status: 400,
    });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const issues: ApiErrorIssue[] = result.error.issues
      .slice(0, 8)
      .map((issue) => ({
        path: issue.path.join(".") || "request",
        message: issue.message,
      }));

    throw new ApiError({
      code: "INVALID_REQUEST",
      message:
        "Some quest details need attention before ReasonWeave can continue.",
      status: 400,
      issues,
    });
  }

  return result.data;
}

export function jsonResponse<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers,
    },
  });
}
