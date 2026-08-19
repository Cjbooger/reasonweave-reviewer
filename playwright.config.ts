import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "no-key-judge-path.spec.ts",
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["line"]] : "list",
  outputDir: "/tmp/wonderlab-playwright-results",
  use: {
    baseURL: "http://127.0.0.1:3000",
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        permissions: [],
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        permissions: [],
      },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command:
      "OPENAI_API_KEY=playwright-test-key WONDERLAB_ALLOW_SEEDED_FALLBACK=true npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
