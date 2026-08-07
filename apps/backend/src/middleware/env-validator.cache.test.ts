import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppBindings } from "@/lib/types/app-types";

const { parseEnvMock } = vi.hoisted(() => ({
  parseEnvMock: vi.fn(),
}));

vi.mock("./env", () => ({ parseEnv: parseEnvMock }));

import { envValidator } from "./env-validator";

describe("envValidator caching", () => {
  const originalVitestEnv = process.env.VITEST;

  beforeEach(() => {
    delete process.env.VITEST;
    parseEnvMock.mockReset();
  });

  afterEach(() => {
    if (originalVitestEnv === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitestEnv;
  });

  it("validates a stable Worker environment only once", async () => {
    const app = new OpenAPIHono<AppBindings>();
    app.use("*", envValidator());
    app.get("/test", (c) => c.json({ ok: true }));

    const env = {
      NODE_ENV: "development",
      TURSO_DATABASE_URL: "libsql://local.db",
    } as any;

    expect((await app.request("/test", undefined, env)).status).toBe(200);
    expect((await app.request("/test", undefined, env)).status).toBe(200);
    expect(parseEnvMock).toHaveBeenCalledOnce();
  });
});
