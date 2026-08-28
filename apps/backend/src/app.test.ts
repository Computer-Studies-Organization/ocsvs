import { describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { loginAttemptRepo } from "@/database/repositories/login-attempt.repository";
import app from "./app";

vi.mock("@libsql/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@libsql/client")>();
  return { ...actual, createClient: vi.fn(actual.createClient) };
});

function buildAssets(status = 200) {
  return {
    fetch: vi.fn(async (request: Request) => {
      return new Response(status === 200 ? `asset:${new URL(request.url).pathname}` : null, {
        status,
        headers: { "Content-Type": "text/html" },
      });
    }),
  };
}

describe("production asset routing", () => {
  it.each(["/docs", "/docs/", "/reference", "/reference/"])(
    "hides %s in production",
    async (path) => {
      const response = await app.request(
        `https://cso-voting.example.workers.dev${path}`,
        { headers: { Accept: "application/json" } },
        { NODE_ENV: "production" } as any,
      );

      expect(response.status).toBe(404);
    },
  );

  it.each(["/docs", "/reference"])("keeps %s available outside production", async (path) => {
    const response = await app.request(
      `https://cso-voting.example.workers.dev${path}`,
      { headers: { Accept: "application/json" } },
      { NODE_ENV: "test" } as any,
    );

    expect(response.status).toBe(200);
  });

  it("serves the SPA shell for the root navigation", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/",
      {
        headers: { Accept: "text/html" },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset:/");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("serves the SPA shell for the voting navigation", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/voting",
      {
        headers: {
          Accept: "text/html",
          "Sec-Fetch-Mode": "navigate",
        },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset:/");
    expect(assets.fetch).toHaveBeenCalledOnce();
    expect(new URL(assets.fetch.mock.calls[0][0].url).pathname).toBe("/");
  });

  it("serves browser navigations through the assets binding", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/auth/login",
      {
        headers: {
          Accept: "text/html",
          "Sec-Fetch-Mode": "navigate",
        },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset:/");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("keeps browser navigation to readiness as a JSON response", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/health/ready",
      {
        headers: {
          Accept: "text/html",
          "Sec-Fetch-Mode": "navigate",
        },
      },
      {
        ASSETS: assets,
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        TURSO_DATABASE_URL: "file::memory:",
      } as any,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("serves the SPA before the overlapping election API routes on navigation", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/elections/election-1",
      {
        headers: {
          Accept: "text/html",
          "Sec-Fetch-Mode": "navigate",
        },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset:/");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("serves static asset requests through the assets binding", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/_app/immutable/entry/start.js",
      undefined,
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset:/_app/immutable/entry/start.js");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("keeps non-navigation HTML requests as JSON 404 responses", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/unknown-endpoint",
      {
        headers: { Accept: "text/html" },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found - /unknown-endpoint" });
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("keeps the JSON 404 response for a JSON request to the root", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/",
      {
        headers: { Accept: "application/json" },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found - /" });
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["/docs/", 200],
    ["/reference/", 200],
    ["/health/", 200],
  ])("keeps the native response for a navigation to %s", async (path, expectedStatus) => {
    const assets = buildAssets();

    const response = await app.request(
      `https://cso-voting.example.workers.dev${path}`,
      {
        headers: {
          Accept: "text/html",
          "Sec-Fetch-Mode": "navigate",
        },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(expectedStatus);
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("keeps JSON 404 responses when a missing dotted asset is requested", async () => {
    const assets = buildAssets(404);

    const response = await app.request(
      "https://cso-voting.example.workers.dev/unknown.json",
      {
        headers: {
          Accept: "text/html",
          "Sec-Fetch-Mode": "navigate",
        },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found - /unknown.json" });
    expect(assets.fetch).toHaveBeenCalledOnce();
    expect(new URL(assets.fetch.mock.calls[0][0].url).pathname).toBe("/unknown.json");
  });

  it("keeps JSON 404 responses for unknown API-style requests", async () => {
    const assets = buildAssets();

    const response = await app.request(
      "https://cso-voting.example.workers.dev/unknown-endpoint",
      {
        headers: { Accept: "application/json" },
      },
      { ASSETS: assets } as any,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: "Not Found - /unknown-endpoint" });
    expect(assets.fetch).not.toHaveBeenCalled();
  });
});

describe("scheduled login-attempt cleanup", () => {
  const env = {
    TURSO_DATABASE_URL: "libsql://scheduled.example",
    TURSO_AUTH_TOKEN: "scheduled-token",
  } as any;

  it("invokes cleanup with the Worker database bindings and closes the client", async () => {
    const close = vi.fn();
    vi.mocked(createClient).mockReturnValueOnce({ close } as any);
    const cleanup = vi.spyOn(loginAttemptRepo, "deleteAllExpiredAttempts").mockResolvedValue();

    await app.scheduled({} as ScheduledController, env);

    expect(createClient).toHaveBeenCalledWith({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
    expect(cleanup).toHaveBeenCalledWith(expect.anything(), 900);
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes the client when cleanup fails", async () => {
    const close = vi.fn();
    vi.mocked(createClient).mockReturnValueOnce({ close } as any);
    vi.spyOn(loginAttemptRepo, "deleteAllExpiredAttempts").mockRejectedValue(
      new Error("database unavailable"),
    );

    await expect(app.scheduled({} as ScheduledController, env)).rejects.toThrow(
      "database unavailable",
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
