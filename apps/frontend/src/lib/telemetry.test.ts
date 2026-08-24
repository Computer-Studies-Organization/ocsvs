import { expect, it, vi } from "vitest";

const { mockInit } = vi.hoisted(() => ({
  mockInit: vi.fn(),
}));
const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
}));

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$env/static/public", () => ({
  PUBLIC_SENTRY_DSN: "https://sentinel.example/123",
}));
vi.mock("@sentry/browser", () => ({
  init: mockInit,
  captureException: mockCaptureException,
}));

import { captureException } from "./telemetry";

it("initializes Sentry asynchronously and forwards captured errors", async () => {
  captureException(new Error("before load"));

  await vi.dynamicImportSettled();

  expect(mockInit).toHaveBeenCalledTimes(1);
  expect(mockInit).toHaveBeenCalledWith({
    dsn: "https://sentinel.example/123",
    environment: "test",
    sendDefaultPii: false,
  });
  expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
});
