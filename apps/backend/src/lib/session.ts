import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { Context } from 'hono'
import { and, eq, gt } from 'drizzle-orm'
import { accounts, sessions } from '@/database/schema'

const SESSION_DURATION_DAYS = 7
const COOKIE_NAME = 'session_id'

type Database = DrizzleD1Database<typeof import('@/database/schema')>

export interface SessionData {
  id: string
  accountId: string
  expiresAt: number
}

/**
 * Creates a new session for the given account.
 * Returns the session ID and expiration timestamp.
 */
export async function createSession(
  db: Database,
  accountId: string,
): Promise<SessionData> {
  const id = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 24 * 60 * 60

  await db.insert(sessions).values({ id, accountId, expiresAt }).run()

  return { id, accountId, expiresAt }
}

/**
 * Retrieves a valid (non-expired) session by ID.
 * Returns null if session doesn't exist or is expired.
 */
export async function getSession(
  db: Database,
  sessionId: string,
): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000)

  const session = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get()

  if (!session) {
    return null
  }

  return {
    id: session.id,
    accountId: session.accountId,
    expiresAt: session.expiresAt,
  }
}

/**
 * Retrieves the account associated with a session.
 */
export async function getSessionAccount(db: Database, sessionId: string) {
  const now = Math.floor(Date.now() / 1000)

  const result = await db
    .select({
      session: sessions,
      account: accounts,
    })
    .from(sessions)
    .innerJoin(accounts, eq(sessions.accountId, accounts.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .get()

  return result
}

/**
 * Deletes a session by ID.
 */
export async function deleteSession(
  db: Database,
  sessionId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId)).run()
}

/**
 * Sets the session cookie on the response.
 */
export function setSessionCookie(
  c: Context,
  sessionId: string,
  expiresAt: number,
): void {
  const expires = new Date(expiresAt * 1000)
  const isProduction = c.env?.NODE_ENV === 'production'

  c.header(
    'Set-Cookie',
    `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${isProduction ? '; Secure' : ''}`,
  )
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie(c: Context): void {
  const isProduction = c.env?.NODE_ENV === 'production'

  c.header(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isProduction ? '; Secure' : ''}`,
  )
}

/**
 * Gets the session ID from the request cookie.
 */
export function getSessionIdFromCookie(c: Context): string | undefined {
  const cookieHeader = c.req.header('Cookie')
  if (!cookieHeader)
    return undefined

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const sessionCookie = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`))

  return sessionCookie?.split('=')[1]
}
