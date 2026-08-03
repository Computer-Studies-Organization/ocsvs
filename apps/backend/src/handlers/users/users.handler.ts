import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createUserRoute,
  deleteUserRoute,
  getUserRoute,
  hardDeleteUserRoute,
  importUsersRoute,
  listUsersRoute,
  restoreUserRoute,
  updateUserRoute,
  unlockUserRoute,
} from "@/routes/users/routes";
import { createDb } from "@/config/db";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { userLifecycleCoordinator, UserLifecycleError } from "@/lib/user-lifecycle-coordinator";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const listUsers: AppRouteHandler<typeof listUsersRoute> = async (c) => {
  const { db } = createDb(c);
  const { page, limit, search, yearLevel, course, includeDeleted } = c.req.valid("query");

  const result = await voterAccountStore.listForAdmin(db, {
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

  const user = await voterAccountStore.findById(db, userId);

  if (!user) {
    return c.json({ message: ERROR_MESSAGES.USER_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  return c.json(user, httpStatusCodes.OK);
};

export const updateUser: AppRouteHandler<typeof updateUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const updateData = c.req.valid("json");
  const actor = {
    id: c.var.authUser.id,
    username: c.var.authUser.username,
    role: c.var.authUser.role,
  };

  try {
    await userLifecycleCoordinator.update(db, userId, updateData, actor);
    const updatedUser = await voterAccountStore.findById(db, userId);

    return c.json(
      {
        message: "User updated successfully",
        user: updatedUser!,
      },
      httpStatusCodes.OK,
    );
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};

export const deleteUser: AppRouteHandler<typeof deleteUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const actor = {
    id: c.var.authUser.id,
    username: c.var.authUser.username,
    role: c.var.authUser.role,
  };

  try {
    await userLifecycleCoordinator.softDelete(db, userId, actor);
    return c.json({ message: "User archived successfully" }, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};

export const restoreUser: AppRouteHandler<typeof restoreUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const actor = {
    id: c.var.authUser.id,
    username: c.var.authUser.username,
    role: c.var.authUser.role,
  };

  try {
    await userLifecycleCoordinator.restore(db, userId, actor);
    return c.json({ message: "User restored successfully" }, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};

export const importUsers: AppRouteHandler<typeof importUsersRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { users: importPayload } = c.req.valid("json");
  const actor = {
    id: c.var.authUser.id,
    username: c.var.authUser.username,
    role: c.var.authUser.role,
  };

  try {
    const result = await userLifecycleCoordinator.bulkImport(db, importPayload, actor);
    return c.json(
      {
        message: "Import completed successfully",
        imported: result.imported,
        skipped: result.skipped,
      },
      httpStatusCodes.OK,
    );
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      if (error.code === "IMPORT_CONFLICT") {
        return c.json(
          {
            message: ERROR_MESSAGES.IMPORT_CONFLICT,
            imported: [],
            skipped: [],
          },
          httpStatusCodes.CONFLICT,
        );
      }
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};

export const hardDeleteUser: AppRouteHandler<typeof hardDeleteUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const actor = {
    id: c.var.authUser.id,
    username: c.var.authUser.username,
    role: c.var.authUser.role,
  };

  try {
    await userLifecycleCoordinator.hardDelete(db, userId, actor);
    return c.json({ message: "User permanently deleted" }, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};

export const createUser: AppRouteHandler<typeof createUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const creatorRole = c.var.authUser.role;
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { firstName, lastName, email, username, password, studentId, course, yearLevel, role } =
    c.req.valid("json");

  // Assertion: Only super admins can create admin/super_admin accounts.
  if (role !== "user" && creatorRole !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const { db } = createDb(c);

  try {
    const regResult = await userLifecycleCoordinator.register(
      db,
      {
        firstName,
        lastName,
        email,
        username,
        password,
        studentId,
        course,
        yearLevel,
        role,
      },
      {
        actorAccountIdSnapshot: actorAccountId,
        actorUsernameSnapshot: actorUsername,
      },
    );

    return c.json(
      {
        message: ERROR_MESSAGES.USER_CREATED_SUCCESSFULLY,
        user: {
          id: regResult.userId,
          email,
          username: regResult.username,
          role,
          studentId,
        },
      },
      httpStatusCodes.CREATED,
    );
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      if (error.code === "USER_ALREADY_EXISTS") {
        return c.json({ message: ERROR_MESSAGES.USER_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
      }
      if (error.code === "PROFANITY_DETECTED") {
        return c.json({ message: error.message }, httpStatusCodes.BAD_REQUEST);
      }
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};

export const unlockUser: AppRouteHandler<typeof unlockUserRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const actor = {
    id: c.var.authUser.id,
    username: c.var.authUser.username,
    role: c.var.authUser.role,
  };

  try {
    await userLifecycleCoordinator.unlock(db, userId, actor);
    return c.json({ message: "User unlocked successfully" }, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};
