import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { accounts, sessions } from "@/database/schema";
import type { Database } from "@/database/repositories/database.type";

const SESSION_DURATION_DAYS = 7;
const LEGACY_COOKIE_NAME = "session_id";
const HOST_COOKIE_NAME = "__Host-session_id";

function usesHostCookie(c: Context): boolean {
  return c.env?.NODE_ENV === "production" || c.env?.NODE_ENV === "staging";
}

function getCookieName(c: Context): string {
  return usesHostCookie(c) ? HOST_COOKIE_NAME : LEGACY_COOKIE_NAME;
}

function cookieOptions(c: Context, expires: Date) {
  const isHttps = c.req?.url?.startsWith("https://") ?? false;

  return {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "Lax" as const,
    secure: usesHostCookie(c) || isHttps,
  };
}

export interface SessionData {
  id: string;
  accountId: string;
  expiresAt: number;
}

/**
 * Creates a new session for the given account.
 * Returns the session ID and expiration timestamp.
 */
export async function createSession(db: Database, accountId: string): Promise<SessionData> {
  const id = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 24 * 60 * 60;

  await db.insert(sessions).values({ id, accountId, expiresAt }).run();

  return { id, accountId, expiresAt };
}

/**
 * Creates a session only while the account still has the hash used to verify
 * the login. The conditional insert closes the password-reset race window.
 */
export async function createSessionIfPasswordUnchanged(
  db: Database,
  accountId: string,
  expectedPasswordHash: string,
): Promise<SessionData | null> {
  const id = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 24 * 60 * 60;
  const result = await db
    .insert(sessions)
    .select(
      db
        .select({
          id: sql<string>`${id}`.as("id"),
          accountId: accounts.id,
          expiresAt: sql<number>`${expiresAt}`.as("expires_at"),
          createdAt: sql<number>`(unixepoch())`.as("created_at"),
        })
        .from(accounts)
        .where(
          and(
            eq(accounts.id, accountId),
            eq(accounts.password_hash, expectedPasswordHash),
            isNull(accounts.deletedAt),
          ),
        ),
    )
    .run();

  return result.rowsAffected === 1 ? { id, accountId, expiresAt } : null;
}

/**
 * Retrieves the account associated with a session.
 */
export async function getSessionAccount(db: Database, sessionId: string) {
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .select({
      session: { expiresAt: sessions.expiresAt },
      account: {
        id: accounts.id,
        email: accounts.email,
        username: accounts.username,
        role: accounts.role,
      },
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now), isNull(accounts.deletedAt)))
    .get();

  return result;
}

/**
 * Deletes a session by ID.
 */
export async function deleteSession(db: Database, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

/**
 * Sets the session cookie on the response.
 */
export function setSessionCookie(c: Context, sessionId: string, expiresAt: number): void {
  setCookie(c, getCookieName(c), sessionId, cookieOptions(c, new Date(expiresAt * 1000)));

  if (usesHostCookie(c)) {
    deleteCookie(c, LEGACY_COOKIE_NAME, cookieOptions(c, new Date(0)));
  }
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie(c: Context): void {
  deleteCookie(c, getCookieName(c), cookieOptions(c, new Date(0)));

  if (usesHostCookie(c)) {
    deleteCookie(c, LEGACY_COOKIE_NAME, cookieOptions(c, new Date(0)));
  }
}

/**
 * Gets the session ID from the request cookie.
 */
export function getSessionIdFromCookie(c: Context): string | undefined {
  if (!c.req?.raw) return undefined;
  return getCookie(c, getCookieName(c));
}
