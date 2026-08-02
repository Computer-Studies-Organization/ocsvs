import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppBindings } from "@/lib/types/app-types";
import { csrfProtection } from "./csrf";

function buildTestApp(env: Record<string, unknown> = {}) {
  const app = new Hono<AppBindings>();
  app.use(csrfProtection());
  app.get("/read", (c) => c.json({ ok: true }));
  app.post("/submit", (c) => c.json({ ok: true }));
  app.put("/put", (c) => c.json({ ok: true }));
  app.patch("/patch", (c) => c.json({ ok: true }));
  app.delete("/delete", (c) => c.json({ ok: true }));

  return {
    request(path: string, init?: RequestInit) {
      return app.request(`http://api.test${path}`, init, env);
    },
  };
}

describe("csrfProtection", () => {
  it("should allow safe methods without an Origin header", async () => {
    const app = buildTestApp();
    const res = await app.request("/read");
    expect(res.status).toBe(200);
  });

  it("should allow unsafe methods from an allowed origin", async () => {
    const app = buildTestApp();
    const res = await app.request("/submit", {
      method: "POST",
      headers: { Origin: "http://localhost:3001" },
    });
    expect(res.status).toBe(200);
  });

  it("should allow unsafe methods from the request's own origin even when not in the allowlist", async () => {
    const app = buildTestApp();
    const res = await app.request("/submit", {
      method: "POST",
      headers: { Origin: "http://api.test" },
    });
    expect(res.status).toBe(200);
  });

  it("should allow unsafe methods when Origin is absent but Referer matches an allowed origin", async () => {
    const app = buildTestApp();
    const res = await app.request("/submit", {
      method: "POST",
      headers: { Referer: "http://localhost:3001/voting" },
    });
    expect(res.status).toBe(200);
  });

  it("should reject unsafe methods with no Origin or Referer", async () => {
    const app = buildTestApp();
    const res = await app.request("/submit", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("should reject unsafe methods from a disallowed origin", async () => {
    const app = buildTestApp();
    const res = await app.request("/submit", {
      method: "POST",
      headers: { Origin: "https://evil.example.edu" },
    });
    expect(res.status).toBe(403);
  });

  it("should reject unsafe methods with a malformed Origin", async () => {
    const app = buildTestApp();
    const res = await app.request("/submit", {
      method: "POST",
      headers: { Origin: "not-a-url" },
    });
    expect(res.status).toBe(403);
  });

  it("should reject unsafe methods from a disallowed Referer", async () => {
    const app = buildTestApp();
    const res = await app.request("/submit", {
      method: "POST",
      headers: { Referer: "https://evil.example.edu/form" },
    });
    expect(res.status).toBe(403);
  });

  it("should enforce the same check on PUT, PATCH and DELETE", async () => {
    const app = buildTestApp();
    const disallowed = { Origin: "https://evil.example.edu" };

    expect((await app.request("/put", { method: "PUT", headers: disallowed })).status).toBe(403);
    expect((await app.request("/patch", { method: "PATCH", headers: disallowed })).status).toBe(
      403,
    );
    expect((await app.request("/delete", { method: "DELETE", headers: disallowed })).status).toBe(
      403,
    );

    expect(
      (await app.request("/put", { method: "PUT", headers: { Origin: "http://localhost:3001" } }))
        .status,
    ).toBe(200);
    expect(
      (
        await app.request("/patch", {
          method: "PATCH",
          headers: { Origin: "http://localhost:3001" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request("/delete", {
          method: "DELETE",
          headers: { Origin: "http://localhost:3001" },
        })
      ).status,
    ).toBe(200);
  });

  it("should honor origins configured via the ALLOWED_ORIGINS binding (array form)", async () => {
    const app = buildTestApp({ ALLOWED_ORIGINS: ["https://vote.example.edu"] });
    const res = await app.request("/submit", {
      method: "POST",
      headers: { Origin: "https://vote.example.edu" },
    });
    expect(res.status).toBe(200);
  });

  it("should honor origins configured via the ALLOWED_ORIGINS binding (comma-separated string form)", async () => {
    const app = buildTestApp({
      ALLOWED_ORIGINS: "https://vote.example.edu, https://cso.example.org,, ,",
    });
    for (const origin of ["https://vote.example.edu", "https://cso.example.org"]) {
      const res = await app.request("/submit", {
        method: "POST",
        headers: { Origin: origin },
      });
      expect(res.status).toBe(200);
    }
    const blocked = await app.request("/submit", {
      method: "POST",
      headers: { Origin: "https://not-allowed.example.edu" },
    });
    expect(blocked.status).toBe(403);
  });
});
