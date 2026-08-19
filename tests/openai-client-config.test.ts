// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { getOpenAIClient } from "@/lib/openai/client";

describe("OpenAI client configuration", () => {
  it("pins the SDK to the official API origin", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("OPENAI_API_KEY", "test-key-that-must-not-be-used");
    try {
      const client = getOpenAIClient();
      expect(client.baseURL).toBe("https://api.openai.com/v1");
      expect(client.maxRetries).toBe(0);
      expect(client.logLevel).toBe("off");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
