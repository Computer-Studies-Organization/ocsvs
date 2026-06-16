import { createRoute, z } from '@hono/zod-openapi'
import {
  CreateElectionBodySchema,
  ElectionSchema,
  ListElectionsQuerySchema,
  TransitionBodySchema,
  UpdateElectionBodySchema,
} from '@/database/openapi-schemas'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import createErrorSchema from '@/middleware/utils/create-error-schema'
import jsonContent from '@/middleware/utils/json-content'
import * as httpStatusCodes from '@/openapi/http-status-codes'

const ErrorSchema = z.object({ message: z.string() })
const IdParams = z.object({ id: z.string() })
const MessageResponse = z.object({ message: z.string() })

export const listElectionsRoute = createRoute({
  method: 'get',
  path: '/elections',
  tags: ['Elections'],
  request: {
    query: ListElectionsQuerySchema,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(z.array(ElectionSchema), 'List of elections'),
  },
})

export const createElectionRoute = createRoute({
  method: 'post',
  path: '/elections',
  tags: ['Elections'],
  request: {
    body: jsonContent(CreateElectionBodySchema, 'Election metadata'),
  },
  responses: {
    [httpStatusCodes.CREATED]: jsonContent(ElectionSchema, ERROR_MESSAGES.ELECTION_CREATED_SUCCESSFULLY),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(CreateElectionBodySchema), 'Validation failed'),
  },
})

export const getCurrentElectionRoute = createRoute({
  method: 'get',
  path: '/elections/current',
  tags: ['Elections'],
  responses: {
    [httpStatusCodes.OK]: jsonContent(ElectionSchema, 'Currently open election'),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorSchema, 'No open election'),
  },
})

export const getElectionRoute = createRoute({
  method: 'get',
  path: '/elections/{id}',
  tags: ['Elections'],
  request: {
    params: IdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(ElectionSchema, 'Election'),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorSchema, 'Election not found'),
  },
})

export const updateElectionRoute = createRoute({
  method: 'patch',
  path: '/elections/{id}',
  tags: ['Elections'],
  request: {
    params: IdParams,
    body: jsonContent(UpdateElectionBodySchema, 'Fields to update'),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(ElectionSchema, ERROR_MESSAGES.ELECTION_UPDATED_SUCCESSFULLY),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorSchema, 'Election not found'),
    [httpStatusCodes.CONFLICT]: jsonContent(ErrorSchema, 'Election not in draft or closed'),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(UpdateElectionBodySchema), 'Validation failed'),
  },
})

export const transitionElectionRoute = createRoute({
  method: 'post',
  path: '/elections/{id}/transitions',
  tags: ['Elections'],
  request: {
    params: IdParams,
    body: jsonContent(TransitionBodySchema, 'Transition request'),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(MessageResponse, 'Transition applied'),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorSchema, 'Election not found'),
    [httpStatusCodes.CONFLICT]: jsonContent(ErrorSchema, 'Invalid transition or conflict'),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(ErrorSchema, 'Invalid transition body'),
  },
})
