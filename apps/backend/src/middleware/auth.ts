import type { Context } from 'hono'
import type { AppBindings, AuthUser } from '@/lib/types/app-types'
import { createMiddleware } from 'hono/factory'
import { createDb } from '@/config/db'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { getSessionAccount, getSessionIdFromCookie } from '@/lib/session'

/**
 * Auth middleware that validates session cookies.
 * Sets `authUser` in context if valid session.
 * Returns 401 if session is missing or invalid.
 */
export const requireAuth = createMiddleware<AppBindings>(async (c, next) => {
  const sessionId = getSessionIdFromCookie(c)

  if (!sessionId) {
    return c.json({ message: 'Unauthorized' }, 401)
  }

  const { db } = createDb(c as Context<AppBindings>)
  const result = await getSessionAccount(db, sessionId)

  if (!result) {
    return c.json({ message: 'Session expired or invalid' }, 401)
  }

  // Store auth user in request context using a simple key
  const user: AuthUser = {
    id: result.account.id,
    email: result.account.email,
    username: result.account.username,
    role: result.account.role,
  }

  c.set('authUser', user)

  await next()
})

export const requireAdmin = createMiddleware<AppBindings>(async (c, next) => {
  const user = c.get('authUser')
  if (user.role !== 'admin') {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, 403)
  }

  await next()
})
