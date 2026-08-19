import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "no-key-judge-path.spec.ts",
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    permissions: [],
  },
  projects: [
    {
      name: "chromium-no-key",
      use: devices["Desktop Chrome"],
    },
  ],
  webServer: {
    command:
      "OPENAI_API_KEY= WONDERLAB_LIVE_GENERATION_ENABLED=false WONDERLAB_ALLOW_SEEDED_FALLBACK=true npm run dev -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
