import type { Context, NotFoundHandler } from "hono";

import type { AppBindings } from "@/lib/types/app-types";
import { NOT_FOUND } from "@/openapi/http-status-codes";
import { isNavigationRequest, normalizePath } from "@/middleware/utils/navigation";

const ASSET_METHODS = new Set(["GET", "HEAD"]);

function isNavigation(c: Context<AppBindings>): boolean {
  return isNavigationRequest({
    method: c.req.method,
    path: c.req.path,
    accept: c.req.header("Accept"),
    secFetchMode: c.req.header("Sec-Fetch-Mode"),
  });
}

function isAssetRequest(c: Context<AppBindings>): boolean {
  if (!ASSET_METHODS.has(c.req.method)) {
    return false;
  }

  const path = normalizePath(c.req.path);

  return isNavigation(c) || /\.[^/]+$/.test(path);
}

function getAssetRequest(c: Context<AppBindings>): Request {
  if (isNavigation(c)) {
    const url = new URL(c.req.url);
    url.pathname = "/";
    return new Request(url, { method: c.req.method, headers: c.req.raw.headers });
  }

  return c.req.raw;
}

/**
 * Global 404 handler for the Hono application.
 *
 * Browser navigation and static asset misses are delegated to Cloudflare Assets
 * when the binding is available. Navigations explicitly fetch the SPA shell so
 * missing data or asset paths cannot be rewritten to HTML.
 *
 * Features:
 * - Returns consistent JSON error format
 * - Includes the requested path in the error message
 * - Uses standardized HTTP status codes and phrases
 *
 * @param c - Hono context object containing request information
 * @returns JSON response with 404 status and error message
 *
 * @example
 * Response format:
 * ```json
 * {
 *   "message": "Not Found - /api/nonexistent-route"
 * }
 * ```
 *
 * Usage in app setup:
 * ```typescript
 * app.notFound(notFound)
 * ```
 */
const notFound: NotFoundHandler = async (c) => {
  if (isAssetRequest(c) && c.env?.ASSETS) {
    const assetResponse = await c.env.ASSETS.fetch(getAssetRequest(c));
    if (assetResponse.status !== NOT_FOUND) {
      return assetResponse;
    }
  }

  return c.json(
    {
      message: `Not Found - ${c.req.path}`,
    },
    NOT_FOUND,
  );
};

export default notFound;
