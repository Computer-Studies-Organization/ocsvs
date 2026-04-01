import { createRoute, z } from '@hono/zod-openapi'
import { UserApiSchema } from '@/database/openapi-schemas'
import jsonContent from '@/middleware/utils/json-content'
import * as httpStatusCodes from '@/openapi/http-status-codes'

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export const listUsersRoute = createRoute({
  tags: ['Users'],
  method: 'get',
  path: '/users',
  request: {
    query: PaginationSchema,
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
