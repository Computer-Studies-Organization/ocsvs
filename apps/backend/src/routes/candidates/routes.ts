import { createRoute, z } from '@hono/zod-openapi'
import { SelectCandidateSchema } from '@/database/openapi-schemas'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import jsonContent from '@/middleware/utils/json-content'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const createCandidateSchema = z.object({
  fullName: z.string(),
  accountId: z.string(),
  position: z.string(),
  manifesto: z.string(),
})

export const updateCandidateSchema = z.object({
  fullName: z.string().optional(),
  position: z.string().optional(),
  manifesto: z.string().optional(),
})

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})
export const ListCandidatesQuerySchema = PaginationSchema.extend({
  includeDeleted: z.coerce.boolean().default(false),
})

export const createCandidateRoute = createRoute({
  tags: ['Candidates'],
  method: 'post',
  path: '/candidates',
  request: {
    body: jsonContent(
      createCandidateSchema,
      'Candidate details',
    ),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        candidate: z.object({
          id: z.string(),
          fullName: z.string(),
          accountId: z.string(),
          position: z.string(),
          manifesto: z.string(),
        }),
      }),
      ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INVALID_REQUEST,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_ALREADY_EXISTS,
    ),
    [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    ),
  },
})

export const listCandidatesRoute = createRoute({
  tags: ['Candidates'],
  method: 'get',
  path: '/candidates',
  request: {
    query: ListCandidatesQuerySchema,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        data: z.array(SelectCandidateSchema as any),
        meta: z.object({
          total: z.number().int(),
          page: z.number().int(),
          limit: z.number().int(),
          totalPages: z.number().int(),
        }),
      }),
      'List of candidates',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
  },
})

export const getCandidateRoute = createRoute({
  tags: ['Candidates'],
  method: 'get',
  path: '/candidates/{id}',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      SelectCandidateSchema as any,
      'Candidate details',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
  },
})

export const updateCandidateRoute = createRoute({
  tags: ['Candidates'],
  method: 'put',
  path: '/candidates/{id}',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: jsonContent(
      updateCandidateSchema,
      'Updated candidate details',
    ),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        candidate: SelectCandidateSchema as any,
      }),
      ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INVALID_REQUEST,
    ),
  },
})

export const deleteCandidateRoute = createRoute({
  tags: ['Candidates'],
  method: 'delete',
  path: '/candidates/{id}',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
  },
})
