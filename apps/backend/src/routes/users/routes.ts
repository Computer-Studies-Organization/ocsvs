import { createRoute, z } from "@hono/zod-openapi";
import { AdminUserApiSchema } from "@/database/openapi-schemas";
import { booleanQuery } from "@/lib/validation/boolean-query";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const ListUsersQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  yearLevel: z.string().optional(),
  course: z.string().optional(),
  includeDeleted: booleanQuery.default("false"),
});

const UpdateUserSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional().or(z.literal("")),
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  yearLevel: z.string().optional(),
  course: z.string().optional(),
});

export const listUsersRoute = createRoute({
  tags: ["Users"],
  method: "get",
  path: "/users",
  security: [{ sessionAuth: [] }],
  request: {
    query: ListUsersQuerySchema,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        data: z.array(AdminUserApiSchema),
        meta: z.object({
          total: z.number().int(),
          page: z.number().int(),
          limit: z.number().int(),
          totalPages: z.number().int(),
        }),
      }),
      "List of users",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized",
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Forbidden",
    ),
  },
});

export const getUserRoute = createRoute({
  tags: ["Users"],
  method: "get",
  path: "/users/{userId}",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      userId: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(AdminUserApiSchema, "User details"),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User not found",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized",
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Forbidden",
    ),
  },
});

export const updateUserRoute = createRoute({
  tags: ["Users"],
  method: "patch",
  path: "/users/{userId}",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      userId: z.string(),
    }),
    body: jsonContent(UpdateUserSchema, "User update data"),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        user: AdminUserApiSchema,
      }),
      "User updated successfully",
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User not found",
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Username already exists",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized",
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Forbidden",
    ),
  },
});

export const deleteUserRoute = createRoute({
  tags: ["Users"],
  method: "delete",
  path: "/users/{userId}",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      userId: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User archived successfully",
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User is already archived",
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User not found",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized",
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Forbidden",
    ),
  },
});

export const restoreUserRoute = createRoute({
  tags: ["Users"],
  method: "post",
  path: "/users/{userId}/restore",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      userId: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User restored successfully",
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User is not archived",
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User not found",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized",
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Forbidden",
    ),
  },
});

export const ImportUsersBodySchema = z
  .object({
    users: z.array(
      z.object({
        studentId: z.string(),
        firstName: z.string(),
        lastName: z.string(),
        course: z.string(),
        yearLevel: z.string(),
      }),
    ),
  })
  .openapi("ImportUsersBody");

export const ImportUsersResponseSchema = z
  .object({
    message: z.string(),
    imported: z.array(
      z.object({
        studentId: z.string(),
        fullName: z.string(),
        username: z.string(),
        password: z.string(),
      }),
    ),
    skipped: z.array(
      z.object({
        studentId: z.string(),
        reason: z.string(),
      }),
    ),
  })
  .openapi("ImportUsersResponse");

export const importUsersRoute = createRoute({
  tags: ["Users"],
  method: "post",
  path: "/users/import",
  security: [{ sessionAuth: [] }],
  request: {
    body: jsonContent(ImportUsersBodySchema, "Voter import payload"),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(ImportUsersResponseSchema, "Import results summary"),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), "Unauthorized"),
    [httpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), "Forbidden"),
  },
});

export const hardDeleteUserRoute = createRoute({
  tags: ["Users"],
  method: "post",
  path: "/users/{userId}/hard-delete",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      userId: z.string(),
    }),
    body: jsonContent(
      z.object({
        confirm: z.literal("DELETE"),
      }),
      "Confirmation to permanently delete user",
    ),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User permanently deleted",
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Validation error (confirmation required, user is candidate, etc.)",
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User not found",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized",
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Forbidden (only super_admin can delete admins)",
    ),
  },
});
