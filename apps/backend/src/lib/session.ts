import type { Context } from "hono";
import { and, eq, gt, isNull } from "drizzle-orm";
import { accounts, sessions } from "@/database/schema";
import type { Database } from "@/database/repositories/database.type";

const SESSION_DURATION_DAYS = 7;
const LEGACY_COOKIE_NAME = "session_id";
const HOST_COOKIE_NAME = "__Host-session_id";
const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

function usesHostCookie(c: Context): boolean {
  return c.env?.NODE_ENV === "production" || c.env?.NODE_ENV === "staging";
}

function getCookieName(c: Context): string {
  return usesHostCookie(c) ? HOST_COOKIE_NAME : LEGACY_COOKIE_NAME;
}

function serializeCookie(name: string, value: string, expires: string, secure: boolean): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secure ? "; Secure" : ""}`;
}

function setCookieHeader(c: Context, value: string, append = false): void {
  if (append) {
    c.header("Set-Cookie", value, { append: true });
  } else {
    c.header("Set-Cookie", value);
  }
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
 * Retrieves a valid (non-expired) session by ID.
 * Returns null if session doesn't exist or is expired.
 */
export async function getSession(db: Database, sessionId: string): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);

  const session = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get();

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    accountId: session.accountId,
    expiresAt: session.expiresAt,
  };
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
  const expires = new Date(expiresAt * 1000);
  const isHttps = c.req?.url?.startsWith("https://") ?? false;
  const isSecure = usesHostCookie(c) || isHttps;

  setCookieHeader(c, serializeCookie(getCookieName(c), sessionId, expires.toUTCString(), isSecure));

  if (usesHostCookie(c)) {
    setCookieHeader(
      c,
      serializeCookie(LEGACY_COOKIE_NAME, "", EXPIRED_COOKIE_DATE, isSecure),
      true,
    );
  }
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie(c: Context): void {
  const isHttps = c.req?.url?.startsWith("https://") ?? false;
  const isSecure = usesHostCookie(c) || isHttps;

  setCookieHeader(c, serializeCookie(getCookieName(c), "", EXPIRED_COOKIE_DATE, isSecure));

  if (usesHostCookie(c)) {
    setCookieHeader(
      c,
      serializeCookie(LEGACY_COOKIE_NAME, "", EXPIRED_COOKIE_DATE, isSecure),
      true,
    );
  }
}

/**
 * Gets the session ID from the request cookie.
 */
export function getSessionIdFromCookie(c: Context): string | undefined {
  const cookieHeader = c.req?.header("Cookie");
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const cookieName = getCookieName(c);
  const prefix = `${cookieName}=`;
  const sessionCookie = cookies.find((cookie) => cookie.startsWith(prefix));

  return sessionCookie?.slice(prefix.length);
}
