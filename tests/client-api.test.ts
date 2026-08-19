import { afterEach, describe, expect, it, vi } from "vitest";

import { postJson } from "@/lib/client-api";

describe("browser API timeout boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a stalled request and returns a retryable timeout without leaving a timer", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          capturedSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      }),
    );

    const request = postJson<{ ok: boolean }>(
      "/api/routes",
      { question: "Could a city run without cars?" },
      { timeoutMs: 25 },
    );
    const rejection = expect(request).rejects.toMatchObject({
      name: "ClientApiError",
      code: "timeout",
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(25);
    await rejection;

    expect(capturedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("forwards an external cancellation and clears its timeout", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          capturedSignal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      }),
    );

    const controller = new AbortController();
    const request = postJson<{ ok: boolean }>(
      "/api/routes",
      { question: "Could a city run without cars?" },
      { signal: controller.signal, timeoutMs: 32_000 },
    );
    const rejection = expect(request).rejects.toMatchObject({
      name: "ClientApiError",
      code: "request_cancelled",
      retryable: false,
    });

    controller.abort();
    await rejection;

    expect(capturedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
