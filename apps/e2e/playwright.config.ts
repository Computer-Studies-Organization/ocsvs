import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html"]] : [["list"], ["html"]],
  use: {
    baseURL: "http://localhost:3001",
    extraHTTPHeaders: {
      Origin: "http://localhost:3001",
    },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
      testMatch: "**/*.spec.ts",
      testIgnore: /global-setup\.ts/,
    },
    ...(process.env.FULL_MATRIX === "true"
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            dependencies: ["setup"],
            testMatch: "**/*.spec.ts",
            testIgnore: /global-setup\.ts/,
          },
          {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
            dependencies: ["setup"],
            testMatch: "**/*.spec.ts",
            testIgnore: /global-setup\.ts/,
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: "pnpm --filter @cso-voting/backend dev",
      url: "http://localhost:8787",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @cso-voting/frontend dev",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
