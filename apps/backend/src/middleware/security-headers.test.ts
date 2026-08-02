import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppBindings } from "@/lib/types/app-types";
import { securityHeaders } from "./security-headers";

function buildTestApp() {
  const app = new Hono<AppBindings>();
  app.use(securityHeaders());
  app.get("/", (c) => c.text("ok"));
  return app;
}

describe("securityHeaders", () => {
  it("should set X-Content-Type-Options to nosniff", async () => {
    const res = await buildTestApp().request("http://api.test/");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("should set X-Frame-Options to DENY", async () => {
    const res = await buildTestApp().request("http://api.test/");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("should set a safe Referrer-Policy", async () => {
    const res = await buildTestApp().request("http://api.test/");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("should set Permissions-Policy denying camera, microphone and geolocation", async () => {
    const res = await buildTestApp().request("http://api.test/");
    const policy = res.headers.get("Permissions-Policy");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });

  it("should set a report-only CSP that forbids framing", async () => {
    const res = await buildTestApp().request("http://api.test/");
    const csp = res.headers.get("Content-Security-Policy-Report-Only");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("should not set Strict-Transport-Security over plain HTTP", async () => {
    const res = await buildTestApp().request("http://api.test/");
    expect(res.headers.get("Strict-Transport-Security")).toBeNull();
  });

  it("should set Strict-Transport-Security over HTTPS", async () => {
    const res = await buildTestApp().request("https://api.test/");
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
  });
});
