export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly code = "request_failed",
    readonly retryable = true,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
}

export async function postJson<TResponse>(
  path: string,
  body: unknown,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<TResponse> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 32_000;
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onAbort = () => controller.abort();
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      (TResponse & ErrorPayload) | null;

    if (!response.ok) {
      throw new ClientApiError(
        payload?.error?.message ??
          "ReasonWeave could not complete that step. Your work is still here.",
        payload?.error?.code ?? "request_failed",
        payload?.error?.retryable ?? response.status >= 500,
        response.status,
      );
    }

    if (!payload) {
      throw new ClientApiError(
        "ReasonWeave received an empty response. Please try again.",
        "empty_response",
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof ClientApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      if (!timedOut && options.signal?.aborted) {
        throw new ClientApiError(
          "That request was cancelled.",
          "request_cancelled",
          false,
        );
      }
      throw new ClientApiError(
        "That request took too long. Your work is saved—try again or use the demo quest.",
        "timeout",
      );
    }

    throw new ClientApiError(
      "ReasonWeave could not reach the quest service. Try again or use the demo quest.",
      "network_error",
    );
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
