import { expect, it, vi } from "vitest";

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$env/static/public", () => ({
  PUBLIC_SENTRY_DSN: "https://sentinel.example/123",
}));
vi.mock("@sentry/browser", () => ({
  init: mockInit,
  captureException: vi.fn(),
}));

import "./telemetry";

it("initializes Sentry with the configured public DSN", () => {
  expect(mockInit).toHaveBeenCalledWith({
    dsn: "https://sentinel.example/123",
    environment: "test",
    sendDefaultPii: false,
  });
});
