import type { AppRouteHandler } from '@/lib/types/app-types'
import type { changePasswordRoute, getMyProfileRoute, updateMyProfileRoute } from '@/routes/profile/routes'
import { and, eq, sql } from 'drizzle-orm'
import { createDb } from '@/config/db'
import { accounts, users } from '@/database/schema'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { hashPassword, verifyPassword } from '@/lib/password'
import { validateProfanity } from '@/lib/profanity'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const getMyProfile: AppRouteHandler<typeof getMyProfileRoute> = async (c) => {
  const { db } = createDb(c)
  const authUser = c.var.authUser

  const profile = await db
    .select({
      id: accounts.id,
      username: accounts.username,
      email: accounts.email,
      role: accounts.role,
      studentId: users.studentId,
      firstName: users.firstName,
      lastName: users.lastName,
      yearLevel: users.yearLevel,
      course: users.course,
    })
    .from(accounts)
    .innerJoin(users, eq(users.accountId, accounts.id))
    .where(eq(accounts.id, authUser.id))
    .get()

  if (!profile) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  return c.json(profile, httpStatusCodes.OK)
}

export const updateMyProfile: AppRouteHandler<typeof updateMyProfileRoute> = async (c) => {
  const { db } = createDb(c)
  const authUser = c.var.authUser
  const updateData = c.req.valid('json')

  // Validate profanity in text fields
  if (updateData.firstName) {
    const validation = validateProfanity(updateData.firstName, 'First name')
    if (!validation.isClean) {
      return c.json(
        { message: validation.message! },
        httpStatusCodes.BAD_REQUEST,
      )
    }
  }

  if (updateData.lastName) {
    const validation = validateProfanity(updateData.lastName, 'Last name')
    if (!validation.isClean) {
      return c.json(
        { message: validation.message! },
        httpStatusCodes.BAD_REQUEST,
      )
    }
  }

  if (updateData.username) {
    const validation = validateProfanity(updateData.username, 'Username')
    if (!validation.isClean) {
      return c.json(
        { message: validation.message! },
        httpStatusCodes.BAD_REQUEST,
      )
    }

    // Check username uniqueness
    const existing = await db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.username, updateData.username),
        sql`${accounts.id} != ${authUser.id}`,
      ))
      .get()

    if (existing) {
      return c.json(
        { message: ERROR_MESSAGES.USERNAME_ALREADY_EXISTS },
        httpStatusCodes.CONFLICT,
      )
    }
  }

  // Get user's userId for users table update
  const user = await db
    .select({ userId: users.id })
    .from(users)
    .where(eq(users.accountId, authUser.id))
    .get()

  if (!user) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  // Update accounts table if account fields present
  const accountFields: any = {}
  if (updateData.username !== undefined) accountFields.username = updateData.username
  if (updateData.email !== undefined) {
    accountFields.email = updateData.email && updateData.email.trim() ? updateData.email : null
  }

  if (Object.keys(accountFields).length > 0) {
    accountFields.updatedAt = sql`CURRENT_TIMESTAMP`
    await db
      .update(accounts)
      .set(accountFields)
      .where(eq(accounts.id, authUser.id))
      .run()
  }

  // Update users table if profile fields present
  const userFields: any = {}
  if (updateData.firstName !== undefined) userFields.firstName = updateData.firstName
  if (updateData.lastName !== undefined) userFields.lastName = updateData.lastName

  if (Object.keys(userFields).length > 0) {
    userFields.updatedAt = sql`CURRENT_TIMESTAMP`
    await db
      .update(users)
      .set(userFields)
      .where(eq(users.id, user.userId))
      .run()
  }

  // Fetch updated profile
  const updatedProfile = await db
    .select({
      id: accounts.id,
      username: accounts.username,
      email: accounts.email,
      role: accounts.role,
      studentId: users.studentId,
      firstName: users.firstName,
      lastName: users.lastName,
      yearLevel: users.yearLevel,
      course: users.course,
    })
    .from(accounts)
    .innerJoin(users, eq(users.accountId, accounts.id))
    .where(eq(accounts.id, authUser.id))
    .get()

  return c.json(
    {
      message: ERROR_MESSAGES.PROFILE_UPDATED_SUCCESSFULLY,
      profile: updatedProfile!,
    },
    httpStatusCodes.OK,
  )
}

export const changePassword: AppRouteHandler<typeof changePasswordRoute> = async (c) => {
  const { db } = createDb(c)
  const authUser = c.var.authUser
  const { currentPassword, newPassword } = c.req.valid('json')

  // Fetch current password hash
  const account = await db
    .select({ password_hash: accounts.password_hash })
    .from(accounts)
    .where(eq(accounts.id, authUser.id))
    .get()

  if (!account) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, account.password_hash)
  if (!isValid) {
    return c.json(
      { message: ERROR_MESSAGES.CURRENT_PASSWORD_INCORRECT },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword)

  // Update password
  await db
    .update(accounts)
    .set({
      password_hash: newPasswordHash,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(accounts.id, authUser.id))
    .run()

  return c.json(
    { message: ERROR_MESSAGES.PASSWORD_CHANGED_SUCCESSFULLY },
    httpStatusCodes.OK,
  )
}
