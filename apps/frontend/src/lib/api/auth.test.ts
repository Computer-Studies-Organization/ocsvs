import { afterEach, expect, test, vi } from "vitest";
import { ApiError } from "./client";
import { me } from "./auth";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

test("me treats an expired session as anonymous", async () => {
  globalThis.fetch = vi.fn(async () => jsonResponse(401, { message: "Unauthorized" }));

  await expect(me()).resolves.toBeNull();
});

test("me propagates unexpected API failures", async () => {
  globalThis.fetch = vi.fn(async () => jsonResponse(503, { message: "Service unavailable" }));

  await expect(me()).rejects.toSatisfy(
    (error: unknown) =>
      error instanceof ApiError && error.status === 503 && error.message === "Service unavailable",
  );
});
