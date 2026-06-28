import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  deleteUserRoute,
  getUserRoute,
  listUsersRoute,
  restoreUserRoute,
  updateUserRoute,
} from "@/routes/users/routes";
import { createDb } from "@/config/db";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { userAccountQueries } from "@/database/queries/user-account.queries";
import { accountRepo } from "@/database/repositories/account.repository";
import { userRepo } from "@/database/repositories/users.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

import * as httpStatusCodes from "@/openapi/http-status-codes";

export const listUsers: AppRouteHandler<typeof listUsersRoute> = async (c) => {
  const { db } = createDb(c);
  const { page, limit, search, yearLevel, course, includeDeleted } = c.req.valid("query");

  const result = await userAccountQueries.listForAdmin(db, {
    page,
    limit,
    search,
    yearLevel,
    course,
    includeDeleted,
  });

  return c.json(
    {
      data: result.data,
      meta: result.meta,
    },
    httpStatusCodes.OK,
  );
};

export const getUser: AppRouteHandler<typeof getUserRoute> = async (c) => {
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");

  const user = await userAccountQueries.findById(db, userId);

  if (!user) {
    return c.json({ message: "User not found" }, httpStatusCodes.NOT_FOUND);
  }

  return c.json(user, httpStatusCodes.OK);
};

export const updateUser: AppRouteHandler<typeof updateUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const updateData = c.req.valid("json");

  // Get user's accountId
  const user = await userRepo.getAccountId(db, userId);

  if (!user) {
    return c.json({ message: "User not found" }, httpStatusCodes.NOT_FOUND);
  }

  // Check for duplicate username if updating
  if (updateData.username) {
    const exists = await accountRepo.usernameExists(db, updateData.username, user.accountId);

    if (exists) {
      return c.json({ message: "Username already exists" }, httpStatusCodes.CONFLICT);
    }
  }

  // Update accounts table if account fields present
  const accountFields: Record<string, unknown> = {};
  if (updateData.username !== undefined) accountFields.username = updateData.username;
  if (updateData.email !== undefined) {
    accountFields.email = updateData.email && updateData.email.trim() ? updateData.email : null;
  }

  if (Object.keys(accountFields).length > 0) {
    await accountRepo.updateAccount(db, user.accountId, accountFields);
  }

  // Update users table if profile fields present
  const userFields: Record<string, unknown> = {};
  if (updateData.firstName !== undefined) userFields.firstName = updateData.firstName;
  if (updateData.lastName !== undefined) userFields.lastName = updateData.lastName;
  if (updateData.yearLevel !== undefined) userFields.yearLevel = updateData.yearLevel;
  if (updateData.course !== undefined) userFields.course = updateData.course;

  if (Object.keys(userFields).length > 0) {
    await userRepo.updateUser(db, userId, userFields);
  }

  try {
    await auditLogRepo.insert(db, {
      action: "user.update",
      targetType: "user",
      targetId: userId,
      actorAccountIdSnapshot: actorAccountId,
      actorUsernameSnapshot: actorUsername,
    });
  } catch (auditErr) {
    c.var.logger.error({ auditErr, action: "user.update", targetId: userId }, "audit insert failed");
  }

  // Fetch updated user
  const updatedUser = await userAccountQueries.findById(db, userId);

  return c.json(
    {
      message: "User updated successfully",
      user: updatedUser!,
    },
    httpStatusCodes.OK,
  );
};

export const deleteUser: AppRouteHandler<typeof deleteUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");

  // Get user's accountId and check if already deleted
  const user = await userAccountQueries.getAccountDeleteStatus(db, userId);

  if (!user) {
    return c.json({ message: "User not found" }, httpStatusCodes.NOT_FOUND);
  }

  if (user.deletedAt !== null) {
    return c.json({ message: "User is already archived" }, httpStatusCodes.BAD_REQUEST);
  }

  await accountRepo.softDelete(db, user.accountId);

  try {
    await auditLogRepo.insert(db, {
      action: "user.soft_delete",
      targetType: "user",
      targetId: userId,
      actorAccountIdSnapshot: actorAccountId,
      actorUsernameSnapshot: actorUsername,
    });
  } catch (auditErr) {
    c.var.logger.error({ auditErr, action: "user.soft_delete", targetId: userId }, "audit insert failed");
  }

  return c.json({ message: "User archived successfully" }, httpStatusCodes.OK);
};

export const restoreUser: AppRouteHandler<typeof restoreUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");

  const user = await userAccountQueries.getAccountDeleteStatus(db, userId);

  if (!user) {
    return c.json({ message: "User not found" }, httpStatusCodes.NOT_FOUND);
  }

  if (user.deletedAt === null) {
    return c.json({ message: "User is not archived" }, httpStatusCodes.BAD_REQUEST);
  }

  await accountRepo.restore(db, user.accountId);

  try {
    await auditLogRepo.insert(db, {
      action: "user.restore",
      targetType: "user",
      targetId: userId,
      actorAccountIdSnapshot: actorAccountId,
      actorUsernameSnapshot: actorUsername,
    });
  } catch (auditErr) {
    c.var.logger.error({ auditErr, action: "user.restore", targetId: userId }, "audit insert failed");
  }

  return c.json({ message: "User restored successfully" }, httpStatusCodes.OK);
};
