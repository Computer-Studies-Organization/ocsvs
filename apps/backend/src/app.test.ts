import { describe, expect, it, vi } from "vitest";
import app from "./app";

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
