import type { AppBindings } from "@/lib/types/app-types";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

// Must match the `period` field in the `ratelimits` config in wrangler.jsonc.
// If the wrangler period changes, update this value too or Retry-After will be incorrect.
const RATE_LIMIT_PERIOD_SECONDS = 60;

export function getClientIp(c: Context): string {
  return c.req.header("CF-Connecting-IP") || "unknown";
}

export function createIpRateLimiter(bindingName: "LOGIN_IP_LIMITER") {
  return createMiddleware<AppBindings>(async (c, next) => {
    const clientIp = getClientIp(c);
    const outcome = await c.env[bindingName].limit({ key: clientIp });

    if (!outcome.success) {
      c.var.logger.warn({ ip: clientIp, binding: bindingName }, "Rate limit exceeded");
      c.header("Retry-After", String(RATE_LIMIT_PERIOD_SECONDS));
      return c.json({ message: ERROR_MESSAGES.RATE_LIMITED_IP }, httpStatusCodes.TOO_MANY_REQUESTS);
    }

    await next();
  });
}
