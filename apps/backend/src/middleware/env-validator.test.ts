import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import type { AppBindings } from "@/lib/types/app-types";
import { envValidator } from "./env-validator";

describe("envValidator middleware", () => {
  const originalVitestEnv = process.env.VITEST;

  beforeEach(() => {
    // Temporarily delete process.env.VITEST to force validation to execute in test suite
    delete process.env.VITEST;
  });

  afterEach(() => {
    process.env.VITEST = originalVitestEnv;
  });

  function buildApp() {
    const app = new OpenAPIHono<AppBindings>();
    const mockLogger = { error: vi.fn() } as any;
    app.use("*", async (c, next) => {
      c.set("logger", mockLogger);
      await next();
    });
    app.use("*", envValidator());
    app.get("/test", (c) => c.json({ ok: true }));
    return { app, mockLogger };
  }

  it("passes validation with correct config", async () => {
    const { app } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "development",
      TURSO_DATABASE_URL: "libsql://local.db",
    } as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
  });

  it("fails validation when TURSO_DATABASE_URL is missing", async () => {
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "development",
      // TURSO_DATABASE_URL is missing
    } as any);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toContain("TURSO_DATABASE_URL");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("fails validation when TURNSTILE_SECRET_KEY is missing in production", async () => {
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://prod.db",
      HMAC_SECRET: "secret-key-32-characters-minimum-pepper",
      // TURNSTILE_SECRET_KEY is missing
    } as any);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toContain("TURNSTILE_SECRET_KEY");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("fails validation when HMAC_SECRET is missing in production", async () => {
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://prod.db",
      TURNSTILE_SECRET_KEY: "secret-key",
      // HMAC_SECRET is missing
    } as any);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toContain("HMAC_SECRET");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("fails validation when HMAC_SECRET is less than 32 characters long", async () => {
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://prod.db",
      TURNSTILE_SECRET_KEY: "secret-key",
      HMAC_SECRET: "short-key",
    } as any);
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toContain(
      "HMAC_SECRET must be at least 32 bytes (or 32 character plain text)",
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("passes validation when TURNSTILE_SECRET_KEY and HMAC_SECRET are provided in production", async () => {
    const { app } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://prod.db",
      TURNSTILE_SECRET_KEY: "secret-key",
      HMAC_SECRET: "secret-key-32-characters-minimum-pepper",
    } as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
  });
});
