import type { MiddlewareHandler } from "hono";
import { parseEnv } from "./env";

/**
 * Middleware that validates environment variables (bindings) on every request in production/development.
 * Skips full validation during Vitest unit/integration testing to avoid breaking partial mocks.
 */
export function envValidator(): MiddlewareHandler {
  return async (c, next) => {
    // Skip full validation during tests to avoid breaking partial environment mocks in unit tests
    if (typeof process !== "undefined" && process.env?.VITEST) {
      await next();
      return;
    }

    try {
      parseEnv(c.env);
    } catch (err: any) {
      const log = c.var.logger || console;
      log.error({ error: err.message }, "Environment validation failed");
      return c.json(
        {
          message: err.message,
        },
        500,
      );
    }
    await next();
  };
}
