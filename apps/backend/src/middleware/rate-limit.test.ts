import { OpenAPIHono } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";

import { createIpRateLimiter, getClientIp } from "./rate-limit";

function buildApp(limitOutcome: { success: boolean }) {
  const app = new OpenAPIHono<{
    Bindings: { LOGIN_IP_LIMITER: { limit: ReturnType<typeof vi.fn> } };
    Variables: { logger: { warn: ReturnType<typeof vi.fn> } };
  }>({ strict: false });

  const mockLogger = { warn: vi.fn() };
  app.use("*", async (c, next) => {
    c.set("logger", mockLogger);
    await next();
  });

  const mockLimiter = { limit: vi.fn().mockResolvedValue(limitOutcome) };
  app.use("/login", createIpRateLimiter("LOGIN_IP_LIMITER"));
  app.post("/login", (c) => c.json({ ok: true }));

  return { app, mockLimiter, mockLogger };
}

describe("createIpRateLimiter", () => {
  it("lets the request through when the limit is not exceeded", async () => {
    const { app, mockLimiter } = buildApp({ success: true });

    const res = await app.request(
      "/login",
      { method: "POST", headers: { "CF-Connecting-IP": "1.2.3.4" } },
      { LOGIN_IP_LIMITER: mockLimiter } as any,
    );

    expect(res.status).toBe(200);
    expect(mockLimiter.limit).toHaveBeenCalledWith({ key: "1.2.3.4" });
  });

  it("returns 429 with Retry-After when the limit is exceeded", async () => {
    const { app, mockLimiter, mockLogger } = buildApp({ success: false });

    const res = await app.request(
      "/login",
      { method: "POST", headers: { "CF-Connecting-IP": "1.2.3.4" } },
      { LOGIN_IP_LIMITER: mockLimiter } as any,
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = (await res.json()) as any;
    expect(body.message).toBe("Too many requests. Please try again later.");
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("does not trust X-Real-IP when CF-Connecting-IP is absent", async () => {
    const { app, mockLimiter } = buildApp({ success: true });

    await app.request("/login", { method: "POST", headers: { "X-Real-IP": "5.6.7.8" } }, {
      LOGIN_IP_LIMITER: mockLimiter,
    } as any);

    expect(mockLimiter.limit).toHaveBeenCalledWith({ key: "unknown" });
  });
});

describe("getClientIp", () => {
  it("returns CF-Connecting-IP when present", async () => {
    const app = new OpenAPIHono();
    app.get("/test", (c) => c.json({ ip: getClientIp(c) }));
    const res = await app.request("/test", { headers: { "CF-Connecting-IP": "9.9.9.9" } });
    const body = (await res.json()) as any;
    expect(body.ip).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no IP header is present", async () => {
    const app = new OpenAPIHono();
    app.get("/test", (c) => c.json({ ip: getClientIp(c) }));
    const res = await app.request("/test");
    const body = (await res.json()) as any;
    expect(body.ip).toBe("unknown");
  });
});
