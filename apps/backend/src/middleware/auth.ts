import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { AppBindings } from "@/lib/types/app-types";
import { createDb } from "@/config/db";
import { getSessionIdFromCookie, getSessionAccount } from "@/lib/session";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

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
    return c.json({ message: "Session expired or invalid" }, 401);
  }

  // Store auth user in request context using a simple key
  (c as any).authUser = {
    id: result.account.id,
    email: result.account.email,
    username: result.account.username,
    role: result.account.role,
  } as AuthUser;

  await next();
});

/**
 * Gets the authenticated user from context.
 * Only call this after requireAuth middleware.
 */
export function getAuthUser(c: Context): AuthUser {
  return (c as any).authUser;
}