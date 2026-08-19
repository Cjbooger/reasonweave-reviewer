import { afterEach, describe, expect, it, vi } from "vitest";

import { apiErrorResponse } from "@/lib/api-errors";
import {
  GLOBAL_CONCURRENCY,
  GLOBAL_REQUESTS_PER_WINDOW,
  PER_SESSION_CONCURRENCY,
  PER_SESSION_REQUESTS_PER_WINDOW,
  generationGuardSnapshotForTests,
  resetGenerationGuardForTests,
  withGenerationPermit,
} from "@/lib/generation-guard";

const SESSION_ID = "wl_generation_guard_test";

afterEach(() => resetGenerationGuardForTests());

describe("anonymous generation guard", () => {
  it("does not invoke paid work after the per-session window is exhausted", async () => {
    for (let index = 0; index < PER_SESSION_REQUESTS_PER_WINDOW; index += 1) {
      await withGenerationPermit(SESSION_ID, async () => "ok", 1_000);
    }
    const paidWork = vi.fn<() => Promise<string>>().mockResolvedValue("called");

    let caught: unknown;
    try {
      await withGenerationPermit(SESSION_ID, paidWork, 1_000);
    } catch (error) {
      caught = error;
    }

    expect(paidWork).not.toHaveBeenCalled();
    const response = apiErrorResponse(caught);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("releases concurrency permits even when generation fails", async () => {
    await expect(
      withGenerationPermit(SESSION_ID, async () => {
        throw new Error("provider failed");
      }),
    ).rejects.toThrow("provider failed");

    await expect(
      withGenerationPermit(SESSION_ID, async () => "recovered"),
    ).resolves.toBe("recovered");
  });

  it("blocks a third simultaneous request without starting its operation", async () => {
    const releases: Array<() => void> = [];
    const pending = () =>
      new Promise<string>((resolve) => releases.push(() => resolve("done")));
    const first = withGenerationPermit(SESSION_ID, pending);
    const second = withGenerationPermit(SESSION_ID, pending);
    expect(PER_SESSION_CONCURRENCY).toBe(2);

    const thirdWork = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue("unexpected");
    await expect(
      withGenerationPermit(SESSION_ID, thirdWork),
    ).rejects.toMatchObject({ status: 429 });
    expect(thirdWork).not.toHaveBeenCalled();

    releases.forEach((release) => release());
    await expect(Promise.all([first, second])).resolves.toEqual([
      "done",
      "done",
    ]);
  });

  it("does not retain fresh identifiers rejected by the global request limit", async () => {
    const now = 1_000;
    for (let index = 0; index < GLOBAL_REQUESTS_PER_WINDOW; index += 1) {
      await withGenerationPermit(`accepted-${index}`, async () => "ok", now);
    }
    const before = generationGuardSnapshotForTests();
    const paidWork = vi.fn<() => Promise<string>>().mockResolvedValue("called");

    const results = await Promise.allSettled(
      Array.from({ length: 10_000 }, (_, index) =>
        withGenerationPermit(`rejected-${index}`, paidWork, now),
      ),
    );

    expect(
      results.every(
        (result) =>
          result.status === "rejected" &&
          apiErrorResponse(result.reason).status === 429,
      ),
    ).toBe(true);
    expect(paidWork).not.toHaveBeenCalled();
    expect(generationGuardSnapshotForTests()).toEqual(before);
    expect(before).toEqual({
      sessionCount: GLOBAL_REQUESTS_PER_WINDOW,
      globalActive: 0,
      globalRequestCount: GLOBAL_REQUESTS_PER_WINDOW,
    });
  });

  it("does not retain a fresh identifier rejected by global concurrency", async () => {
    const releases: Array<() => void> = [];
    const pending = () =>
      new Promise<string>((resolve) => releases.push(() => resolve("done")));
    const active = Array.from({ length: GLOBAL_CONCURRENCY }, (_, index) =>
      withGenerationPermit(`active-${index}`, pending, 1_000),
    );
    const before = generationGuardSnapshotForTests();
    const rejectedWork = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue("unexpected");

    await expect(
      withGenerationPermit("fresh-rejected", rejectedWork, 1_000),
    ).rejects.toMatchObject({ status: 429 });

    expect(rejectedWork).not.toHaveBeenCalled();
    expect(generationGuardSnapshotForTests()).toEqual(before);
    expect(before).toEqual({
      sessionCount: GLOBAL_CONCURRENCY,
      globalActive: GLOBAL_CONCURRENCY,
      globalRequestCount: GLOBAL_CONCURRENCY,
    });

    releases.forEach((release) => release());
    await expect(Promise.all(active)).resolves.toEqual(
      Array.from({ length: GLOBAL_CONCURRENCY }, () => "done"),
    );
  });

  it("opens a new request window after sixty seconds", async () => {
    for (let index = 0; index < PER_SESSION_REQUESTS_PER_WINDOW; index += 1) {
      await withGenerationPermit(SESSION_ID, async () => "ok", 1_000);
    }

    await expect(
      withGenerationPermit(SESSION_ID, async () => "new window", 61_001),
    ).resolves.toBe("new window");
  });
});
