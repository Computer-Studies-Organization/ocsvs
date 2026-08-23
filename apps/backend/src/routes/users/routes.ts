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
  role: z.enum(["user", "admin", "super_admin"]).optional(),
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

const IMPORT_COURSES = ["BSCS", "BSIT", "WADT"] as const;
const IMPORT_YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;

export const ImportUsersBodySchema = z
  .object({
    users: z
      .array(
        z.object({
          studentId: z.string().regex(/^C\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}$/),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          course: z.enum(IMPORT_COURSES),
          yearLevel: z.enum(IMPORT_YEAR_LEVELS),
        }),
      )
      // Cap at 300 to stay within Cloudflare Workers' paid-plan CPU time limit (30s).
      // Each record runs hashPassword() sequentially (PBKDF2-SHA256, 100k iterations
      // in lib/password.ts); at ~10-20ms per hash, 300 records ≈ 6s, leaving headroom
      // for the DB queries and batch inserts. If ITERATIONS is ever changed, re-benchmark this ceiling.
      .max(300, "Maximum batch size is 300 records per request"),
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
    [httpStatusCodes.CONFLICT]: jsonContent(
      ImportUsersResponseSchema,
      "Concurrent import username conflict — retry",
    ),
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

export const createUserBodySchema = z
  .object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email().optional().or(z.literal("")).nullable(),
    username: z.string().min(3).max(50).optional().or(z.literal("")).nullable(),
    password: z.string().min(8),
    studentId: z
      .string()
      .regex(/^C\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}$/, "Invalid Student ID format"),
    course: z.enum(IMPORT_COURSES),
    yearLevel: z.enum(IMPORT_YEAR_LEVELS),
    role: z.enum(["user", "admin", "super_admin"]).optional().default("user"),
  })
  .openapi("CreateUserBody");

export const createUserResponseSchema = z
  .object({
    message: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string().email().nullable(),
      username: z.string(),
      role: z.enum(["user", "admin", "super_admin"]),
      studentId: z.string(),
    }),
  })
  .openapi("CreateUserResponse");

export const createUserRoute = createRoute({
  tags: ["Users"],
  method: "post",
  path: "/users",
  security: [{ sessionAuth: [] }],
  request: {
    body: jsonContent(createUserBodySchema, "Single user creation details"),
  },
  responses: {
    [httpStatusCodes.CREATED]: jsonContent(createUserResponseSchema, "User created successfully"),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ message: z.string() }),
      "Invalid request",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), "Unauthorized"),
    [httpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), "Forbidden"),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({ message: z.string() }),
      "User already exists",
    ),
  },
});

export const unlockUserRoute = createRoute({
  tags: ["Users"],
  method: "post",
  path: "/users/{userId}/unlock",
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
      "User unlocked successfully",
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User not found",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ message: z.string() }), "Unauthorized"),
    [httpStatusCodes.FORBIDDEN]: jsonContent(z.object({ message: z.string() }), "Forbidden"),
  },
});
