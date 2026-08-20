import type { Context } from "hono";
import type { AppBindings, AppRouteHandler, AuthUser } from "@/lib/types/app-types";
import { createMiddleware } from "hono/factory";
import { createDb } from "@/config/db";
import { ROLES } from "@/database/schema";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { getSessionAccount, getSessionIdFromCookie } from "@/lib/session";

/**
 * Auth middleware that validates session cookies.
 * Sets `authUser` in context if valid session.
 * Returns 401 if session is missing or invalid.
 */
export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const sessionId = getSessionIdFromCookie(c);

  if (!sessionId) {
    return c.json({ message: "Unauthorized" }, 401);
  }

  const { db } = createDb(c as Context<AppBindings>);
  const result = await getSessionAccount(db, sessionId);

  if (!result) {
    return c.json({ message: ERROR_MESSAGES.SESSION_EXPIRED }, 401);
  }

  const roleResult = ROLES.safeParse(result.account.role);
  if (!roleResult.success) {
    return c.json({ message: ERROR_MESSAGES.SESSION_EXPIRED }, 401);
  }

  // Store auth user in request context using a simple key
  const user: AuthUser = {
    id: result.account.id,
    email: result.account.email,
    username: result.account.username,
    role: roleResult.data,
  };

  c.set("authUser", user);

  await next();
});

export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
  const user = c.get("authUser");
  if (user.role !== "admin" && user.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, 403);
  }

  await next();
});

/**
 * Higher-order function that wraps an OpenAPI route handler with an admin role check.
 * Guarantees that the handler only executes if authUser role is 'admin' or 'super_admin'.
 */
export function withAdmin<T extends AppRouteHandler<any>>(handler: T): T {
  return (async (c: Parameters<T>[0], next: Parameters<T>[1]) => {
    const user = c.get("authUser");
    if (user?.role !== "admin" && user?.role !== "super_admin") {
      return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, 403);
    }
    return handler(c, next);
  }) as unknown as T;
}
