import { defineConfig, devices } from "@playwright/test";

const offlineDatabaseUrl = "http://127.0.0.1:8080";
const offline = process.env.OFFLINE_DEV !== "false";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8787",
    extraHTTPHeaders: {
      Origin: process.env.E2E_ORIGIN ?? "http://localhost:8787",
    },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "worker-smoke",
      testMatch: "worker/*.spec.ts",
    },
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: "**/*.spec.ts",
      testIgnore: [/global-setup\.ts/, /worker\/.*\.spec\.ts/],
    },
    ...(process.env.FULL_MATRIX === "true"
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            dependencies: ["setup"],
            testMatch: "**/*.spec.ts",
            testIgnore: [/global-setup\.ts/, /worker\/.*\.spec\.ts/],
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            dependencies: ["setup"],
            testMatch: "**/*.spec.ts",
            testIgnore: [/global-setup\.ts/, /worker\/.*\.spec\.ts/],
          },
        ]
      : []),
  ],
  webServer: [
    ...(offline
      ? [
          {
            command: "turso dev --db-file ../../apps/backend/local.db --port 8080",
            url: `${offlineDatabaseUrl}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
    {
      command: offline
        ? "pnpm --filter @cso-voting/backend e2e:worker:offline"
        : "pnpm --filter @cso-voting/backend exec wrangler dev --env test --var TURSO_DATABASE_URL:http://127.0.0.1:8080 --port 8787",
      url: "http://localhost:8787/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
