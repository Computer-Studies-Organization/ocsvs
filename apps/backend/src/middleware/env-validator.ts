import type { MiddlewareHandler } from "hono";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { parseEnv } from "./env";

/**
 * Middleware that validates environment bindings before requests in production/development.
 * Reuses successful validation while the Worker environment object is stable.
 * Skips full validation during Vitest unit/integration testing to avoid breaking partial mocks.
 */
export function envValidator(): MiddlewareHandler {
  let validatedEnvironment: object | undefined;

  return async (c, next) => {
    // Skip full validation during tests to avoid breaking partial environment mocks in unit tests
    if (typeof process !== "undefined" && process.env?.VITEST) {
      await next();
      return;
    }

    try {
      if (validatedEnvironment !== c.env) {
        parseEnv(c.env);
        validatedEnvironment = c.env;
      }
    } catch (err: any) {
      const log = c.var.logger || console;
      log.error({ error: err.message }, "Environment validation failed");
      return c.json(
        {
          message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        },
        500,
      );
    }
    await next();
  };
}
