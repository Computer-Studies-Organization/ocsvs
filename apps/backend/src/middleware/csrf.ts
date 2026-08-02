import type { AppBindings } from "@/lib/types/app-types";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Origins always trusted: the frontend dev server. Production origins are either
 * same-origin (frontend served by this Worker) or configured via the
 * ALLOWED_ORIGINS binding (comma-separated).
 */
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3001"];

/**
 * Extracts the requesting origin from the Origin header, falling back to the
 * Referer header when Origin is absent. Returns null when neither is present
 * or the Referer cannot be parsed.
 */
function extractOrigin(c: Context): string | null {
  const origin = c.req.header("Origin");
  if (origin) {
    return origin;
  }

  const referer = c.req.header("Referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Validates that a raw Origin value is a bare http(s) origin with no path,
 * query string, or credentials.
 */
function isValidOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash
  );
}

/**
 * Same-origin validation for state-changing methods (POST, PUT, PATCH, DELETE).
 * Browsers send the Origin header on these requests; the check blocks CSRF from
 * sibling subdomains and cross-site origins that SameSite=Lax alone cannot stop.
 * Requests without a verifiable origin are rejected.
 */
export function csrfProtection() {
  return createMiddleware<AppBindings>(async (c, next) => {
    if (!UNSAFE_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    const origin = extractOrigin(c);
    if (!origin || !isValidOrigin(origin)) {
      return c.json(
        { message: ERROR_MESSAGES.CROSS_SITE_REQUEST_FORBIDDEN },
        httpStatusCodes.FORBIDDEN,
      );
    }

    let requestOrigin: string;
    try {
      requestOrigin = new URL(c.req.url).origin;
    } catch {
      return c.json(
        { message: ERROR_MESSAGES.CROSS_SITE_REQUEST_FORBIDDEN },
        httpStatusCodes.FORBIDDEN,
      );
    }

    // Environment (parseEnv, scripts only) types this as string[], but at runtime the
    // Worker binding arrives as a raw comma-separated string.
    const configuredOriginsRaw = (c.env?.ALLOWED_ORIGINS ?? []) as string | string[];
    const configuredOrigins =
      typeof configuredOriginsRaw === "string"
        ? configuredOriginsRaw
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
        : Array.isArray(configuredOriginsRaw)
          ? configuredOriginsRaw
          : [];
    const allowedOrigins = new Set([
      ...DEFAULT_ALLOWED_ORIGINS,
      ...configuredOrigins,
      requestOrigin,
    ]);

    if (!allowedOrigins.has(origin)) {
      return c.json(
        { message: ERROR_MESSAGES.CROSS_SITE_REQUEST_FORBIDDEN },
        httpStatusCodes.FORBIDDEN,
      );
    }

    await next();
  });
}
