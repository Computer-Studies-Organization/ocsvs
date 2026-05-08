import { createRoute, z } from '@hono/zod-openapi'
import { UserApiSchema } from '@/database/openapi-schemas'
import jsonContent from '@/middleware/utils/json-content'
import * as httpStatusCodes from '@/openapi/http-status-codes'

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

const ListUsersQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  yearLevel: z.string().optional(),
  course: z.string().optional(),
  includeDeleted: z.coerce.boolean().default(false),
})

const UpdateUserSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  yearLevel: z.string().optional(),
  course: z.string().optional(),
})

export const listUsersRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users',
  request: {
    query: ListUsersQuerySchema,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        data: z.array(UserApiSchema as any),
        meta: z.object({
          total: z.number().int(),
          page: z.number().int(),
          limit: z.number().int(),
          totalPages: z.number().int(),
        }),
      }),
      'List of users',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Unauthorized',
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Forbidden',
    ),
  },
})

export const getUserRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users/{userId}',
  request: {
    params: z.object({
      userId: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      UserApiSchema as any,
      'User details',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'User not found',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Unauthorized',
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Forbidden',
    ),
  },
})

export const updateUserRoute = createRoute({
  tags: ['Users'],
  method: 'patch',
  path: '/users/{userId}',
  request: {
    params: z.object({
      userId: z.string(),
    }),
    body: jsonContent(UpdateUserSchema, 'User update data'),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        user: UserApiSchema as any,
      }),
      'User updated successfully',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'User not found',
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Username already exists',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Unauthorized',
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Forbidden',
    ),
  },
})

export const deleteUserRoute = createRoute({
  tags: ['Users'],
  method: 'delete',
  path: '/users/{userId}',
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
      'User archived successfully',
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'User is already archived',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'User not found',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Unauthorized',
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Forbidden',
    ),
  },
})

export const restoreUserRoute = createRoute({
  tags: ['Users'],
  method: 'post',
  path: '/users/{userId}/restore',
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
      'User restored successfully',
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'User is not archived',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'User not found',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Unauthorized',
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Forbidden',
    ),
  },
})
