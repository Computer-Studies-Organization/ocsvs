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
import { userAccountQueries } from "@/database/queries/user-account.queries";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { userLifecycleCoordinator, UserLifecycleError } from "@/lib/user-lifecycle-coordinator";
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
  const { db } = createDb(c);
  const { userId } = c.req.valid("param");
  const updateData = c.req.valid("json");
  const actor = {
    id: c.var.authUser.id,
    username: c.var.authUser.username,
    role: c.var.authUser.role as any,
  };

  try {
    await userLifecycleCoordinator.update(db, userId, updateData, actor);
    const updatedUser = await userAccountQueries.findById(db, userId);

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
    role: c.var.authUser.role as any,
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
    role: c.var.authUser.role as any,
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
    role: c.var.authUser.role as any,
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
    role: c.var.authUser.role as any,
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
