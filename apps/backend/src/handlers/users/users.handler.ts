import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  deleteUserRoute,
  getUserRoute,
  hardDeleteUserRoute,
  importUsersRoute,
  listUsersRoute,
  restoreUserRoute,
  updateUserRoute,
} from "@/routes/users/routes";
import { createDb } from "@/config/db";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { userAccountQueries } from "@/database/queries/user-account.queries";
import { accountRepo } from "@/database/repositories/account.repository";
import { userRepo } from "@/database/repositories/users.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { inArray } from "drizzle-orm";
import { accounts, users } from "@/database/schema";
import { hashPassword } from "@/lib/password";

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
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const updateData = c.req.valid("json");

  // Get user's accountId and role for permission checks
  const user = await userAccountQueries.getAccountDeleteStatus(db, userId);

  if (!user) {
    return c.json({ message: "User not found" }, httpStatusCodes.NOT_FOUND);
  }

  // Prevent regular admin from updating another admin/super_admin
  const isTargetAdmin = user.role === "admin" || user.role === "super_admin";
  if (isTargetAdmin && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.CANNOT_UPDATE_ADMIN }, httpStatusCodes.FORBIDDEN);
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

  await auditLogRepo.insert(db, {
    action: "user.update",
    targetType: "user",
    targetId: userId,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

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
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
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

  // Prevent admin from deleting themselves
  if (c.var.authUser.id === user.accountId) {
    return c.json({ message: ERROR_MESSAGES.CANNOT_DELETE_SELF }, httpStatusCodes.BAD_REQUEST);
  }

  // Role-based permission checks: only super_admin can delete admins/super_admins
  const isTargetAdmin = user.role === "admin" || user.role === "super_admin";

  if (isTargetAdmin) {
    const requesterRole = c.var.authUser.role as string;
    if (requesterRole !== "super_admin") {
      return c.json({ message: ERROR_MESSAGES.CANNOT_DELETE_ADMIN }, httpStatusCodes.FORBIDDEN);
    }

    // Cannot delete the last admin/super_admin
    const adminCount = await accountRepo.countActiveAdminsAndSuperAdmins(db);
    if (adminCount <= 1) {
      return c.json(
        { message: ERROR_MESSAGES.CANNOT_DELETE_LAST_ADMIN },
        httpStatusCodes.BAD_REQUEST,
      );
    }
  }

  await accountRepo.softDelete(db, user.accountId);

  await auditLogRepo.insert(db, {
    action: "user.soft_delete",
    targetType: "user",
    targetId: userId,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  return c.json({ message: "User archived successfully" }, httpStatusCodes.OK);
};

export const restoreUser: AppRouteHandler<typeof restoreUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
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

  // Prevent regular admin from restoring admin/super_admin accounts
  const isTargetAdmin = user.role === "admin" || user.role === "super_admin";
  if (isTargetAdmin && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.CANNOT_RESTORE_ADMIN }, httpStatusCodes.FORBIDDEN);
  }

  await accountRepo.restore(db, user.accountId);

  await auditLogRepo.insert(db, {
    action: "user.restore",
    targetType: "user",
    targetId: userId,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  return c.json({ message: "User restored successfully" }, httpStatusCodes.OK);
};

function generateVoterUsername(
  firstName: string,
  lastName: string,
  studentId: string,
  existingUsernames: Set<string>,
): string {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  let baseUsername = `${cleanFirst}.${cleanLast}`;
  if (baseUsername.length < 3) {
    baseUsername = studentId.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  let username = baseUsername;
  let counter = 1;
  while (existingUsernames.has(username)) {
    username = `${baseUsername}.${counter}`;
    counter++;
  }
  existingUsernames.add(username);
  return username;
}

export const importUsers: AppRouteHandler<typeof importUsersRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);

  const { users: importPayload } = c.req.valid("json");

  if (!importPayload || importPayload.length === 0) {
    return c.json(
      {
        message: "Empty import list",
        imported: [],
        skipped: [],
      },
      httpStatusCodes.OK,
    );
  }

  const studentIdsToCheck = importPayload.map((u) => u.studentId);
  const existingUsers = await db
    .select({ studentId: users.studentId })
    .from(users)
    .where(inArray(users.studentId, studentIdsToCheck))
    .all();

  const existingStudentIdsSet = new Set(existingUsers.map((u) => u.studentId));

  const existingAccounts = await db.select({ username: accounts.username }).from(accounts).all();

  const existingUsernamesSet = new Set(existingAccounts.map((a) => a.username));

  const imported: {
    studentId: string;
    fullName: string;
    username: string;
    password: string;
  }[] = [];

  const skipped: {
    studentId: string;
    reason: string;
  }[] = [];

  const dbOps: any[] = [];
  const charset = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (const record of importPayload) {
    if (existingStudentIdsSet.has(record.studentId)) {
      skipped.push({
        studentId: record.studentId,
        reason: "Student ID already exists in the system",
      });
      continue;
    }
    existingStudentIdsSet.add(record.studentId);

    let rawPassword = "";
    while (rawPassword.length < 10) {
      const byte = new Uint8Array(1);
      crypto.getRandomValues(byte);
      if (byte[0] < 228) {
        // 228 = 57 * 4, eliminating modulo bias
        rawPassword += charset[byte[0] % charset.length];
      }
    }

    const hashedPassword = await hashPassword(rawPassword);
    const username = generateVoterUsername(
      record.firstName,
      record.lastName,
      record.studentId,
      existingUsernamesSet,
    );

    const accountId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    dbOps.push(
      db.insert(accounts).values({
        id: accountId,
        role: "user",
        username,
        password_hash: hashedPassword,
      }),
    );

    dbOps.push(
      db.insert(users).values({
        id: userId,
        accountId,
        studentId: record.studentId,
        firstName: record.firstName,
        lastName: record.lastName,
        course: record.course,
        yearLevel: record.yearLevel,
      }),
    );

    imported.push({
      studentId: record.studentId,
      fullName: `${record.firstName} ${record.lastName}`.trim().toUpperCase(),
      username,
      password: rawPassword,
    });
  }

  if (dbOps.length > 0) {
    await db.batch(dbOps as any);

    await auditLogRepo.insert(db, {
      action: "user.bulk_import",
      targetType: "user",
      targetId: crypto.randomUUID(),
      actorAccountIdSnapshot: actorAccountId,
      actorUsernameSnapshot: actorUsername,
      description: `Bulk imported ${imported.length} voter account${imported.length !== 1 ? "s" : ""}${skipped.length > 0 ? ` (${skipped.length} skipped)` : ""}`,
    });
  }

  return c.json(
    {
      message: "Import completed successfully",
      imported,
      skipped,
    },
    httpStatusCodes.OK,
  );
};

export const hardDeleteUser: AppRouteHandler<typeof hardDeleteUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  // confirm is validated by Zod at route level to be "DELETE"

  // Perform checks and hard delete atomically in a transaction
  const result = await db.transaction(async (tx) => {
    // Get user's accountId and check status inside transaction to avoid TOCTOU
    const user = await userAccountQueries.getAccountDeleteStatus(tx, userId);

    if (!user) {
      return {
        error: ERROR_MESSAGES.USER_NOT_FOUND,
        statusCode: httpStatusCodes.NOT_FOUND,
      };
    }

    // Prevent admin from deleting themselves
    if (actorAccountId === user.accountId) {
      return {
        error: ERROR_MESSAGES.CANNOT_DELETE_SELF,
        statusCode: httpStatusCodes.BAD_REQUEST,
      };
    }

    // Role-based permission checks
    const isTargetAdmin = user.role === "admin" || user.role === "super_admin";

    if (isTargetAdmin) {
      // Only super_admin can delete admins/super_admins
      const requesterRole = c.var.authUser.role as string;
      if (requesterRole !== "super_admin") {
        return {
          error: ERROR_MESSAGES.CANNOT_DELETE_ADMIN,
          statusCode: httpStatusCodes.FORBIDDEN,
        };
      }
    }

    // Check if user is a candidate (active or deactivated)
    const isCandidate = await candidateRepo.isCandidate(tx, user.accountId);
    if (isCandidate) {
      return {
        error: ERROR_MESSAGES.USER_IS_CANDIDATE,
        statusCode: httpStatusCodes.BAD_REQUEST,
      };
    }

    if (isTargetAdmin && user.deletedAt === null) {
      // Cannot delete the last admin/super_admin
      const adminCount = await accountRepo.countActiveAdminsAndSuperAdmins(tx);
      if (adminCount <= 1) {
        return {
          error: ERROR_MESSAGES.CANNOT_DELETE_LAST_ADMIN,
          statusCode: httpStatusCodes.BAD_REQUEST,
        };
      }
    }

    // Get username and studentId for audit log before deletion
    const userWithDetails = await userAccountQueries.findById(tx, userId);
    const username = userWithDetails?.username ?? "unknown";
    const studentId = userWithDetails?.studentId ?? "unknown";

    // Perform hard delete
    await accountRepo.hardDelete(tx, user.accountId);

    // Create audit log entry
    await auditLogRepo.insert(tx, {
      action: "user.hard_delete",
      targetType: "user",
      targetId: userId,
      actorAccountIdSnapshot: actorAccountId,
      actorUsernameSnapshot: actorUsername,
      description: `Permanently deleted: ${username} (${studentId})`,
    });

    return { success: true };
  });

  if ("error" in result && result.error) {
    return c.json({ message: result.error }, result.statusCode as 400 | 403 | 404);
  }

  return c.json({ message: "User permanently deleted" }, httpStatusCodes.OK);
};
