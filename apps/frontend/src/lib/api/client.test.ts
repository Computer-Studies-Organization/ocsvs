// `$env/static/public` is a SvelteKit virtual module resolved at build time
// by Vite. For tests, `tsx` resolves it via the `paths` entry in
// `tsconfig.json` to `./test-shims/env-static-public.ts`, which exports the
// same constant from `process.env`.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ApiError, apiFetch } from "./client";

// ---------- helpers ----------

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface CapturedRequest {
  url: string;
  init: RequestInit | undefined;
}

let lastRequest: CapturedRequest | null = null;

const originalFetch = globalThis.fetch;

/** Install a fetch stub; the most recent (url, init) pair is exposed via `lastRequest`. */
function stubFetch(handler: FetchHandler): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    lastRequest = { url: String(input), init };
    return handler(input, init);
  }) as typeof fetch;
}

function jsonResponse(status: number, body: unknown, statusText?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: statusText ?? "",
    headers: { "Content-Type": "application/json" },
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  lastRequest = null;
});

// ---------- tests ----------

test("apiFetch resolves to parsed JSON body on 2xx", async () => {
  stubFetch(async () => jsonResponse(200, { elections: [{ id: "e1" }] }));

  const result = await apiFetch<{ elections: { id: string }[] }>("/elections");

  assert.deepEqual(result, { elections: [{ id: "e1" }] });
});

test("apiFetch resolves to undefined on 204 No Content", async () => {
  stubFetch(async () => new Response(null, { status: 204 }));

  const result = await apiFetch("/ping");

  assert.equal(result, undefined);
});

test("apiFetch throws ApiError with body's message on non-2xx", async () => {
  stubFetch(async () => jsonResponse(400, { message: "Invalid input" }, "Bad Request"));

  await assert.rejects(
    () => apiFetch("/ping"),
    (err: unknown) =>
      err instanceof ApiError && err.status === 400 && err.message === "Invalid input",
  );
});

test("apiFetch falls back to statusText when error body has no message field", async () => {
  stubFetch(async () => jsonResponse(500, {}, "Internal Server Error"));

  await assert.rejects(
    () => apiFetch("/ping"),
    (err: unknown) =>
      err instanceof ApiError && err.status === 500 && err.message === "Internal Server Error",
  );
});

test("apiFetch falls back to statusText when error body is unparseable JSON", async () => {
  stubFetch(
    async () =>
      new Response("not-json", {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "Content-Type": "text/plain" },
      }),
  );

  await assert.rejects(
    () => apiFetch("/ping"),
    (err: unknown) =>
      err instanceof ApiError && err.status === 502 && err.message === "Bad Gateway",
  );
});

test("apiFetch propagates network errors (fetch rejects)", async () => {
  stubFetch(async () => {
    throw new TypeError("Failed to fetch");
  });

  await assert.rejects(
    () => apiFetch("/ping"),
    (err: unknown) => err instanceof TypeError && err.message === "Failed to fetch",
  );
});

test("apiFetch sends credentials: 'include' and Content-Type: application/json", async () => {
  stubFetch(async () => jsonResponse(200, { ok: true }));

  await apiFetch("/ping", { method: "POST", body: "{}" });

  assert.equal(lastRequest?.init?.credentials, "include");
  const headers = lastRequest?.init?.headers as Record<string, string>;
  assert.equal(headers?.["Content-Type"], "application/json");
});

test("apiFetch builds URL from PUBLIC_API_BASE_URL + path", async () => {
  stubFetch(async () => jsonResponse(200, {}));

  await apiFetch("/elections");

  assert.equal(lastRequest?.url, "http://test.local/elections");
});

test("apiFetch merges caller-provided headers on top of defaults", async () => {
  stubFetch(async () => jsonResponse(200, {}));

  await apiFetch("/ping", { headers: { "X-Custom": "yes" } });

  const headers = lastRequest?.init?.headers as Record<string, string>;
  assert.equal(headers?.["Content-Type"], "application/json");
  assert.equal(headers?.["X-Custom"], "yes");
});
