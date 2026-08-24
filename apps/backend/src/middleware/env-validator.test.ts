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
    if (originalVitestEnv === undefined) delete process.env.VITEST;
    else process.env.VITEST = originalVitestEnv;
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

  it("rejects unknown NODE_ENV values", async () => {
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "prodction",
      TURSO_DATABASE_URL: "libsql://local.db",
    } as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Internal server error" });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("fails validation when TURSO_DATABASE_URL is missing", async () => {
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "development",
      // TURSO_DATABASE_URL is missing
    } as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Internal server error" });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("fails validation when TURNSTILE_SECRET_KEY is missing in production", async () => {
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://prod.db",
      HMAC_SECRET: "c2VjcmV0LWtleS0zMi1jaGFyYWN0ZXJzLW1pbmltdW0tcGVwcGVy",
      // TURNSTILE_SECRET_KEY is missing
    } as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Internal server error" });
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
    expect(await res.json()).toEqual({ message: "Internal server error" });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("fails validation when HMAC_SECRET decodes to fewer than 32 bytes", async () => {
    const shortBase64Secret = btoa("x".repeat(31));
    const { app, mockLogger } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://prod.db",
      TURNSTILE_SECRET_KEY: "secret-key",
      HMAC_SECRET: shortBase64Secret,
    } as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Internal server error" });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("passes validation when TURNSTILE_SECRET_KEY and HMAC_SECRET are provided in production", async () => {
    const { app } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "production",
      TURSO_DATABASE_URL: "libsql://prod.db",
      TURNSTILE_SECRET_KEY: "secret-key",
      HMAC_SECRET: "c2VjcmV0LWtleS0zMi1jaGFyYWN0ZXJzLW1pbmltdW0tcGVwcGVy",
    } as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
  });

  it("passes validation when TURNSTILE_SECRET_KEY and HMAC_SECRET are provided in staging", async () => {
    const { app } = buildApp();
    const res = await app.request("/test", { method: "GET" }, {
      NODE_ENV: "staging",
      TURSO_DATABASE_URL: "libsql://staging.db",
      TURNSTILE_SECRET_KEY: "secret-key",
      HMAC_SECRET: "c2VjcmV0LWtleS0zMi1jaGFyYWN0ZXJzLW1pbmltdW0tcGVwcGVy",
    } as any);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
  });
});
