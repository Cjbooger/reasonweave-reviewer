import { describe, expect, it } from "vitest";

import {
  assertLiveGenerationEnabled,
  isLiveGenerationAvailable,
  isLiveGenerationEnabled,
  MAX_LIVE_RELEASE_WINDOW_MS,
} from "@/lib/live-generation";

const NOW = Date.parse("2026-07-17T20:00:00.000Z");
const APPROVED_SHA = "a".repeat(40);

const enabledProduction = {
  NODE_ENV: "production",
  OPENAI_MODEL: "gpt-5.6",
  WONDERLAB_LIVE_GENERATION_ENABLED: "true",
  WONDERLAB_LIVE_GENERATION_EXPIRES_AT: "2026-08-06T00:15:00.000Z",
} as const;

describe("production live-generation release lock", () => {
  it("keeps local development and tests usable without deployment controls", () => {
    expect(isLiveGenerationEnabled({ NODE_ENV: "development" }, NOW)).toBe(
      true,
    );
    expect(isLiveGenerationEnabled({ NODE_ENV: "test" }, NOW)).toBe(true);
  });

  it("requires a nonblank server key before exposing live exploration", () => {
    expect(
      isLiveGenerationAvailable(
        { NODE_ENV: "development", OPENAI_API_KEY: "" },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationAvailable(
        { NODE_ENV: "development", OPENAI_API_KEY: "  test-key  " },
        NOW,
      ),
    ).toBe(true);
    expect(isLiveGenerationAvailable(enabledProduction, NOW)).toBe(false);
    expect(
      isLiveGenerationAvailable(
        { ...enabledProduction, OPENAI_API_KEY: "test-key" },
        NOW,
      ),
    ).toBe(true);
  });

  it("defaults production to seeded-only and requires exact enablement", () => {
    expect(isLiveGenerationEnabled({ NODE_ENV: "production" }, NOW)).toBe(
      false,
    );
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          WONDERLAB_LIVE_GENERATION_ENABLED: " true ",
        },
        NOW,
      ),
    ).toBe(false);
    expect(isLiveGenerationEnabled(enabledProduction, NOW)).toBe(true);
  });

  it("rejects missing, invalid, past, and overlong UTC expiry windows", () => {
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          WONDERLAB_LIVE_GENERATION_EXPIRES_AT: "",
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          WONDERLAB_LIVE_GENERATION_EXPIRES_AT: "not-a-dateZ",
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          WONDERLAB_LIVE_GENERATION_EXPIRES_AT: "2026-07-17T19:59:59.999Z",
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          WONDERLAB_LIVE_GENERATION_EXPIRES_AT: new Date(
            NOW + MAX_LIVE_RELEASE_WINDOW_MS + 1,
          ).toISOString(),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("allows only the required GPT-5.6 model", () => {
    expect(
      isLiveGenerationEnabled(
        { ...enabledProduction, OPENAI_MODEL: "gpt-5.6-mini" },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled({ ...enabledProduction, OPENAI_MODEL: "" }, NOW),
    ).toBe(true);
  });

  it("binds Vercel live mode to an exact full deployment SHA", () => {
    expect(
      isLiveGenerationEnabled({ ...enabledProduction, VERCEL: "1" }, NOW),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          VERCEL: "1",
          VERCEL_GIT_COMMIT_SHA: "a".repeat(39),
          WONDERLAB_LIVE_RELEASE_SHA: "a".repeat(39),
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          VERCEL: "1",
          VERCEL_GIT_COMMIT_SHA: "g".repeat(40),
          WONDERLAB_LIVE_RELEASE_SHA: "g".repeat(40),
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          VERCEL: "1",
          VERCEL_GIT_COMMIT_SHA: APPROVED_SHA,
          WONDERLAB_LIVE_RELEASE_SHA: "b".repeat(40),
        },
        NOW,
      ),
    ).toBe(false);
    expect(
      isLiveGenerationEnabled(
        {
          ...enabledProduction,
          VERCEL: "1",
          VERCEL_GIT_COMMIT_SHA: APPROVED_SHA,
          WONDERLAB_LIVE_RELEASE_SHA: APPROVED_SHA,
        },
        NOW,
      ),
    ).toBe(true);
  });

  it("rechecks time so an enabled deployment expires without code changes", () => {
    const expiry = Date.parse(
      enabledProduction.WONDERLAB_LIVE_GENERATION_EXPIRES_AT,
    );
    expect(isLiveGenerationEnabled(enabledProduction, expiry - 1)).toBe(true);
    expect(isLiveGenerationEnabled(enabledProduction, expiry)).toBe(false);
  });

  it("returns one sanitized release-lock error for every failed condition", () => {
    expect(() =>
      assertLiveGenerationEnabled({ NODE_ENV: "production" }, NOW),
    ).toThrow(
      expect.objectContaining({
        code: "LIVE_GENERATION_DISABLED",
        status: 503,
        retryable: false,
        message:
          "Live generation is not enabled for this deployment. You can continue with the demo quest.",
      }),
    );
  });
});
