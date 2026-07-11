import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  changePasswordRoute,
  getMyProfileRoute,
  updateMyProfileRoute,
} from "@/routes/profile/routes";
import { createDb } from "@/config/db";
import { userAccountQueries } from "@/database/queries/user-account.queries";
import { accountRepo } from "@/database/repositories/account.repository";
import { userRepo } from "@/database/repositories/users.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { isUniqueConstraintError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie } from "@/lib/session";
import { validateProfanity } from "@/lib/profanity";
import * as httpStatusCodes from "@/openapi/http-status-codes";

class UsernameTakenError extends Error {
  constructor() {
    super(ERROR_MESSAGES.USERNAME_ALREADY_EXISTS);
    this.name = "UsernameTakenError";
  }
}

export const getMyProfile: AppRouteHandler<typeof getMyProfileRoute> = async (c) => {
  const { db } = createDb(c);
  const authUser = c.var.authUser;

  const profile = await userAccountQueries.getProfile(db, authUser.id);

  if (!profile) {
    return c.json({ message: ERROR_MESSAGES.USER_NOT_FOUND }, httpStatusCodes.UNAUTHORIZED);
  }

  return c.json(profile, httpStatusCodes.OK);
};

export const updateMyProfile: AppRouteHandler<typeof updateMyProfileRoute> = async (c) => {
  const { db } = createDb(c);
  const authUser = c.var.authUser;
  const updateData = c.req.valid("json");

  // Validate profanity in text fields
  if (updateData.firstName) {
    const validation = validateProfanity(updateData.firstName, "First name");
    if (!validation.isClean) {
      return c.json({ message: validation.message! }, httpStatusCodes.BAD_REQUEST);
    }
  }

  if (updateData.lastName) {
    const validation = validateProfanity(updateData.lastName, "Last name");
    if (!validation.isClean) {
      return c.json({ message: validation.message! }, httpStatusCodes.BAD_REQUEST);
    }
  }

  if (updateData.username) {
    const validation = validateProfanity(updateData.username, "Username");
    if (!validation.isClean) {
      return c.json({ message: validation.message! }, httpStatusCodes.BAD_REQUEST);
    }
  }

  // Get user record by account ID for users table update
  const user = await userRepo.findByAccountId(db, authUser.id);

  if (!user) {
    return c.json({ message: ERROR_MESSAGES.USER_NOT_FOUND }, httpStatusCodes.UNAUTHORIZED);
  }

  // Update accounts and users tables atomically. The username-uniqueness check
  // runs inside the transaction to close the TOCTOU window where another
  // request could claim the username between the pre-check and the write. The
  // accounts.username unique index is the hard guarantee; the in-tx check
  // provides a clean 409 instead of relying solely on the constraint.
  try {
    await db.transaction(async (tx) => {
      if (updateData.username) {
        const usernameTaken = await accountRepo.usernameExists(
          tx,
          updateData.username,
          authUser.id,
        );
        if (usernameTaken) {
          throw new UsernameTakenError();
        }
      }

      const accountFields: Record<string, unknown> = {};
      if (updateData.username !== undefined) accountFields.username = updateData.username;
      if (updateData.email !== undefined) {
        accountFields.email = updateData.email && updateData.email.trim() ? updateData.email : null;
      }

      if (Object.keys(accountFields).length > 0) {
        await accountRepo.updateAccount(tx, authUser.id, accountFields);
      }

      // Update users table if profile fields present
      const userFields: Record<string, unknown> = {};
      if (updateData.firstName !== undefined) userFields.firstName = updateData.firstName;
      if (updateData.lastName !== undefined) userFields.lastName = updateData.lastName;

      if (Object.keys(userFields).length > 0) {
        await userRepo.updateUser(tx, user.id, userFields);
      }
    });
  } catch (error) {
    if (error instanceof UsernameTakenError) {
      return c.json({ message: ERROR_MESSAGES.USERNAME_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
    }
    if (isUniqueConstraintError(error)) {
      return c.json({ message: ERROR_MESSAGES.USERNAME_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
    }
    throw error;
  }

  // Fetch updated profile
  const updatedProfile = await userAccountQueries.getProfile(db, authUser.id);

  return c.json(
    {
      message: ERROR_MESSAGES.PROFILE_UPDATED_SUCCESSFULLY,
      profile: updatedProfile!,
    },
    httpStatusCodes.OK,
  );
};

export const changePassword: AppRouteHandler<typeof changePasswordRoute> = async (c) => {
  const { db } = createDb(c);
  const authUser = c.var.authUser;
  const { currentPassword, newPassword } = c.req.valid("json");

  // Fetch current password hash
  const account = await accountRepo.getPasswordHash(db, authUser.id);

  if (!account) {
    return c.json({ message: ERROR_MESSAGES.USER_NOT_FOUND }, httpStatusCodes.UNAUTHORIZED);
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, account.password_hash);
  if (!isValid) {
    return c.json(
      { message: ERROR_MESSAGES.CURRENT_PASSWORD_INCORRECT },
      httpStatusCodes.UNAUTHORIZED,
    );
  }

  // Invalidate all existing sessions and update the password atomically.
  // libSQL runs the batch as a single implicit transaction: either both the
  // session deletion and the password update apply, or neither does. This
  // closes the window where one write could succeed while the other fails.
  const newPasswordHash = await hashPassword(newPassword);
  try {
    await accountRepo.changePasswordAndInvalidateSessions(db, authUser.id, newPasswordHash);
  } catch (error) {
    c.var.logger?.error(
      { error, accountId: authUser.id },
      "Failed to change password and invalidate sessions",
    );
    return c.json(
      { message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR },
      httpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  try {
    // Create a new session for the current user
    const session = await createSession(db, authUser.id);
    setSessionCookie(c, session.id, session.expiresAt);
  } catch (error) {
    c.var.logger?.error(
      { error, accountId: authUser.id },
      "Failed to regenerate session after password change",
    );
    return c.json(
      { message: ERROR_MESSAGES.PASSWORD_CHANGED_PLEASE_RE_LOGIN, sessionRotated: false },
      httpStatusCodes.OK,
    );
  }

  return c.json(
    { message: ERROR_MESSAGES.PASSWORD_CHANGED_SUCCESSFULLY, sessionRotated: true },
    httpStatusCodes.OK,
  );
};
