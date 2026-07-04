import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  deleteUserRoute,
  getUserRoute,
  importUsersRoute,
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
import { inArray } from "drizzle-orm";
import { accounts, auditLog, users } from "@/database/schema";
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

  // Prevent admin from deleting themselves
  if (c.var.authUser.id === user.accountId) {
    return c.json({ message: ERROR_MESSAGES.CANNOT_DELETE_SELF }, httpStatusCodes.BAD_REQUEST);
  }

  // Prevent deleting the last admin
  if (user.role === "admin") {
    const adminCount = await accountRepo.countActiveAdmins(db);
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
  if (c.var.authUser.role !== "admin") {
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

    const randomBytes = new Uint8Array(10);
    crypto.getRandomValues(randomBytes);
    let rawPassword = "";
    for (let i = 0; i < 10; i++) {
      rawPassword += charset[randomBytes[i] % charset.length];
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

    dbOps.push(
      db.insert(auditLog).values({
        id: crypto.randomUUID(),
        action: "user.create",
        targetType: "user",
        targetId: userId,
        actorAccountIdSnapshot: actorAccountId,
        actorUsernameSnapshot: actorUsername,
        description: `Bulk imported student account: ${record.studentId}`,
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
