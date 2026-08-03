import { describe, expect, it } from "vitest";
import app from "@/app";

describe("health route", () => {
  it("returns a public health response without database or session state", async () => {
    const response = await app.request("/health", undefined, {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      TURSO_DATABASE_URL: "file::memory:",
    } as any);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
