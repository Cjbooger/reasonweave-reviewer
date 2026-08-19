import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  APIError as OpenAIAPIError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "CONTENT_BLOCKED"
  | "MODEL_REFUSAL"
  | "UNSAFE_ACTIVITY"
  | "CITATIONS_UNAVAILABLE"
  | "INVALID_MODEL_RESPONSE"
  | "LIVE_GENERATION_DISABLED"
  | "OPENAI_NOT_CONFIGURED"
  | "OPENAI_AUTH_ERROR"
  | "OPENAI_RATE_LIMITED"
  | "OPENAI_TIMEOUT"
  | "OPENAI_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiErrorIssue {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
    issues?: ApiErrorIssue[];
  };
}

interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  status: number;
  retryable?: boolean;
  issues?: ApiErrorIssue[];
  cause?: unknown;
  retryAfterSeconds?: number;
}

/** A deliberately user-safe error. Never put learner content in this object. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly issues?: ApiErrorIssue[];
  readonly retryAfterSeconds?: number;

  constructor({
    code,
    message,
    status,
    retryable = false,
    issues,
    cause,
    retryAfterSeconds,
  }: ApiErrorOptions) {
    super(message, { cause });
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.issues = issues;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function mapOpenAIError(error: unknown): ApiError | undefined {
  if (
    error instanceof APIConnectionTimeoutError ||
    error instanceof APIUserAbortError ||
    (error instanceof DOMException &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
  ) {
    return new ApiError({
      code: "OPENAI_TIMEOUT",
      message:
        "The live quest took too long to generate. Try again or use the demo quest.",
      status: 504,
      retryable: true,
      cause: error,
    });
  }

  if (error instanceof RateLimitError) {
    return new ApiError({
      code: "OPENAI_RATE_LIMITED",
      message:
        "Live generation is busy right now. Try again shortly or use the demo quest.",
      status: 429,
      retryable: true,
      cause: error,
    });
  }

  if (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError
  ) {
    return new ApiError({
      code: "OPENAI_AUTH_ERROR",
      message:
        "Live generation is not available. You can continue with the demo quest.",
      status: 503,
      cause: error,
    });
  }

  if (error instanceof APIConnectionError) {
    return new ApiError({
      code: "OPENAI_UNAVAILABLE",
      message:
        "ReasonWeave could not reach live generation. Try again or use the demo quest.",
      status: 503,
      retryable: true,
      cause: error,
    });
  }

  if (error instanceof OpenAIAPIError) {
    const retryable =
      error.status === undefined ||
      error.status === 408 ||
      error.status === 409 ||
      error.status === 429 ||
      error.status >= 500;

    return new ApiError({
      code: retryable ? "OPENAI_UNAVAILABLE" : "INVALID_REQUEST",
      message: retryable
        ? "Live generation is temporarily unavailable. Try again or use the demo quest."
        : "ReasonWeave could not process that request. Check the details and try again.",
      status: retryable ? 503 : 400,
      retryable,
      cause: error,
    });
  }

  return undefined;
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const openAIError = mapOpenAIError(error);
  if (openAIError) {
    return openAIError;
  }

  return new ApiError({
    code: "INTERNAL_ERROR",
    message:
      "ReasonWeave hit an unexpected problem. Try again or use the demo quest.",
    status: 500,
    retryable: true,
    cause: error,
  });
}

export function apiErrorResponse(error: unknown): Response {
  const normalized = normalizeApiError(error);
  const body: ApiErrorBody = {
    error: {
      code: normalized.code,
      message: normalized.message,
      retryable: normalized.retryable,
      ...(normalized.issues ? { issues: normalized.issues } : {}),
    },
  };

  return Response.json(body, {
    status: normalized.status,
    headers: {
      "Cache-Control": "no-store",
      ...(normalized.retryAfterSeconds
        ? { "Retry-After": String(normalized.retryAfterSeconds) }
        : {}),
    },
  });
}
