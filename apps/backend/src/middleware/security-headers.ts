import type { AppBindings } from "@/lib/types/app-types";
import { createMiddleware } from "hono/factory";

const HSTS_VALUE = "max-age=31536000; includeSubDomains";

/**
 * CSP for the SPA documents served by this Worker: self-hosted scripts,
 * Google Fonts, Cloudflare Turnstile, and Svelte runtime-injected styles.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/**
 * Sets application security headers on every response. Applied after
 * `run_worker_first: true` so it also covers the static assets (HTML/JS/CSS).
 * HSTS is only emitted over HTTPS (RFC 6797 requires ignoring it over HTTP).
 */
export function securityHeaders() {
  return createMiddleware<AppBindings>(async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    const cspHeader =
      c.env?.NODE_ENV === "development" || c.env?.NODE_ENV === "test"
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";
    c.header(cspHeader, CSP);

    if (c.req.url.startsWith("https://")) {
      c.header("Strict-Transport-Security", HSTS_VALUE);
    }

    await next();
  });
}
