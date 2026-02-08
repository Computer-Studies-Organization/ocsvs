import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { AppBindings } from "@/lib/types/app-types";
import { createDb } from "@/config/db";
import { getSessionIdFromCookie, getSessionAccount } from "@/lib/session";

/**
 * Auth middleware that validates session cookies.
 * Attaches session and account to context variables if valid.
 * Returns 401 if session is missing or invalid.
 */
export const requireAuth = createMiddleware<
  AppBindings & {
    Variables: {
      sessionId: string;
      accountId: string;
      account: {
        id: string;
        email: string;
        username: string;
        role: string;
      };
    };
  }
>(async (c, next) => {
  const sessionId = getSessionIdFromCookie(c);

  if (!sessionId) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const { db } = createDb(c as unknown as Context<AppBindings>);
  const result = await getSessionAccount(db, sessionId);

  if (!result) {
    return c.json({ message: "Session expired or invalid" }, 401);
  }

  c.set("sessionId", sessionId);
  c.set("accountId", result.account.id);
  c.set("account", {
    id: result.account.id,
    email: result.account.email,
    username: result.account.username,
    role: result.account.role,
  });

  await next();
});
