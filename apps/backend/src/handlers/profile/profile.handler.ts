import type { AppRouteHandler } from '@/lib/types/app-types'
import type { changePasswordRoute, getMyProfileRoute, updateMyProfileRoute } from '@/routes/profile/routes'
import { createDb } from '@/config/db'
import { accountRepo } from '@/database/repositories/account.repository'
import { userRepo } from '@/database/repositories/users.repository'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { hashPassword, verifyPassword } from '@/lib/password'
import { validateProfanity } from '@/lib/profanity'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const getMyProfile: AppRouteHandler<typeof getMyProfileRoute> = async (c) => {
  const { db } = createDb(c)
  const authUser = c.var.authUser

  const profile = await userRepo.getProfile(db, authUser.id)

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

    const usernameTaken = await accountRepo.usernameExists(db, updateData.username, authUser.id)
    if (usernameTaken) {
      return c.json(
        { message: ERROR_MESSAGES.USERNAME_ALREADY_EXISTS },
        httpStatusCodes.CONFLICT,
      )
    }
  }

  // Get user record by account ID for users table update
  const user = await userRepo.findByAccountId(db, authUser.id)

  if (!user) {
    return c.json(
      { message: ERROR_MESSAGES.USER_NOT_FOUND },
      httpStatusCodes.UNAUTHORIZED,
    )
  }

  // Update accounts table if account fields present
  const accountFields: Record<string, unknown> = {}
  if (updateData.username !== undefined)
    accountFields.username = updateData.username
  if (updateData.email !== undefined) {
    accountFields.email = updateData.email && updateData.email.trim() ? updateData.email : null
  }

  if (Object.keys(accountFields).length > 0) {
    await accountRepo.updateAccount(db, authUser.id, accountFields)
  }

  // Update users table if profile fields present
  const userFields: Record<string, unknown> = {}
  if (updateData.firstName !== undefined)
    userFields.firstName = updateData.firstName
  if (updateData.lastName !== undefined)
    userFields.lastName = updateData.lastName

  if (Object.keys(userFields).length > 0) {
    await userRepo.updateUser(db, user.id, userFields)
  }

  // Fetch updated profile
  const updatedProfile = await userRepo.getProfile(db, authUser.id)

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
  const account = await accountRepo.getPasswordHash(db, authUser.id)

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

  // Hash new password and update
  const newPasswordHash = await hashPassword(newPassword)
  await accountRepo.updatePassword(db, authUser.id, newPasswordHash)

  return c.json(
    { message: ERROR_MESSAGES.PASSWORD_CHANGED_SUCCESSFULLY },
    httpStatusCodes.OK,
  )
}
