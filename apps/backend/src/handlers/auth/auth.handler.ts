import type { AppRouteHandler } from '@/lib/types/app-types'
import type { loginRoute, logoutRoute, meRoute, registerRoute } from '@/routes/auth/routes'
import { eq, or } from 'drizzle-orm'
import { createDb } from '@/config/db'
import { accounts, users } from '@/database/schema'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { hashPassword, verifyPassword } from '@/lib/password'
import { clearSessionCookie, createSession, deleteSession, getSessionIdFromCookie, setSessionCookie } from '@/lib/session'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const register: AppRouteHandler<typeof registerRoute> = async (c) => {
  const {
    firstName,
    lastName,
    email,
    username,
    password,
    studentId,
    course,
    yearLevel,
  } = c.req.valid('json')
  const { db } = createDb(c)

  const conditions = [eq(accounts.username, username)]
  if (email && email.trim()) {
    conditions.push(eq(accounts.email, email))
  }

  const existing = await db
    .select()
    .from(accounts)
    .where(or(...conditions))
    .get()

  if (existing) {
    return c.json(
      { message: ERROR_MESSAGES.USER_ALREADY_EXISTS },
      httpStatusCodes.CONFLICT,
    )
  }

  const accountId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  await db
    .insert(accounts)
    .values({
      id: accountId,
      username,
      email: email && email.trim() ? email : null,
      password_hash: passwordHash,
      role: 'user',
    })
    .run()

  await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      accountId,
      studentId,
      firstName,
      lastName,
      course,
      yearLevel,
    })
    .run()

  return c.json(
    {
      message: ERROR_MESSAGES.USER_REGISTERED_SUCCESSFULLY,
      user: {
        id: accountId,
        email,
        username,
        role: 'user',
        studentId,
      },
    },
    httpStatusCodes.OK,
  )
}

export const login: AppRouteHandler<typeof loginRoute> = async (c) => {
  const { studentNumber, password } = c.req.valid('json')
  const { db } = createDb(c)

  c.var.logger.info({ studentNumber, passwordLength: password.length }, 'Login attempt')

  // Only authenticate by studentId via users table (joined)
  const result = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      username: accounts.username,
      password_hash: accounts.password_hash,
      role: accounts.role,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      lastLogin: accounts.lastLogin,
      deletedAt: accounts.deletedAt,
    })
    .from(users)
    .innerJoin(accounts, eq(users.accountId, accounts.id))
    .where(eq(users.studentId, studentNumber))
    .get()

  if (!result) {
    c.var.logger.warn({ studentNumber }, 'User not found')
    return c.json(
      { message: ERROR_MESSAGES.INVALID_CREDENTIALS },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  if (result.deletedAt !== null) {
    c.var.logger.warn({ studentNumber }, 'User deleted')
    return c.json(
      { message: ERROR_MESSAGES.INVALID_CREDENTIALS },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  const isValid = await verifyPassword(password, result.password_hash)
  c.var.logger.info({ isValid, hashLength: result.password_hash.length }, 'Password verification')

  if (!isValid) {
    return c.json(
      { message: ERROR_MESSAGES.INVALID_CREDENTIALS },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  // Create session and set cookie
  const session = await createSession(db, result.id)
  setSessionCookie(c, session.id, session.expiresAt)

  return c.json(
    {
      message: ERROR_MESSAGES.USER_LOGGED_IN_SUCCESSFULLY,
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        role: result.role,
      },
    },
    httpStatusCodes.OK,
  )
}

export const logout: AppRouteHandler<typeof logoutRoute> = async (c) => {
  const { db } = createDb(c)
  const sessionId = getSessionIdFromCookie(c)

  if (sessionId) {
    await deleteSession(db, sessionId)
  }

  clearSessionCookie(c)

  return c.json(
    { message: ERROR_MESSAGES.LOGGED_OUT_SUCCESSFULLY },
    httpStatusCodes.OK,
  )
}

export const me: AppRouteHandler<typeof meRoute> = async (c) => {
  const account = c.var.authUser

  return c.json(
    {
      user: {
        id: account.id,
        email: account.email,
        username: account.username,
        role: account.role,
      },
    },
    httpStatusCodes.OK,
  )
}
