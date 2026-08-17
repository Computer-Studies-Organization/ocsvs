import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn(),
}));

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: { run: mockRun } })),
}));

import app from "@/app";

describe("readiness route", () => {
  beforeEach(() => {
    mockRun.mockReset();
  });

  it("returns ready when the database probe succeeds", async () => {
    mockRun.mockResolvedValueOnce({ rows: [] });

    const response = await app.request("/health/ready", undefined, {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      TURSO_DATABASE_URL: "file::memory:",
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns unavailable when the database probe fails", async () => {
    mockRun.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await app.request("/health/ready", undefined, {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      TURSO_DATABASE_URL: "file::memory:",
    } as any);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });
});
