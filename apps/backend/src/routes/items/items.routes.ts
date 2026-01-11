import { createRoute, z } from '@hono/zod-openapi'
import { apiItemsSchema, insertItemApiSchema, insertItemSchema, patchItemApiSchema } from '@/database/schema'
import createErrorSchema from '@/middleware/utils/create-error-schema'
import IdParamsSchema from '@/middleware/utils/id-params-validator'
import jsonContent, { jsonContentRequired } from '@/middleware/utils/json-content'
import * as httpStatusCodes from '@/openapi/http-status-codes'

const tags = ['items']

export const listOfItems = createRoute({
  path: '/items',
  method: 'get',
  tags,
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.array(apiItemsSchema),
      'List of items',
    ),
  },
})

export const createItem = createRoute({
  path: '/items',
  method: 'post',
  request: {
    body: jsonContentRequired(
      insertItemApiSchema,
      'The item to create',
    ),
  },
  tags,
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      apiItemsSchema,
      'The created item',
    ),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent (
      createErrorSchema(insertItemSchema),
      'The item is invalid',
    ),
  },
})

export const getItem = createRoute({
  path: '/items/{id}',
  method: 'get',
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      apiItemsSchema,
      'List of items',
    ),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent (
      createErrorSchema(insertItemSchema),
      'Invalid Id error',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent (
      z.object({
        message: z.string(),
      }).openapi({
        example: {
          message: 'Item not found',
        },
      }),
      'Item not found',
    ),
  },
})

export const patch = createRoute({
  path: '/items/{id}',
  method: 'patch',
  request: {
    params: IdParamsSchema,
    body: jsonContentRequired(
      patchItemApiSchema,
      'The item to update',
    ),
  },
  tags,
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      apiItemsSchema,
      'The updated item',
    ),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(patchItemApiSchema)
        .or(createErrorSchema(IdParamsSchema)),
      'Invalid Id or item error',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent (
      z.object({
        message: z.string(),
      }).openapi({
        example: {
          message: 'Item not found',
        },
      }),
      'Item not found',
    ),
  },
})

export const remove = createRoute({
  path: '/items/{id}',
  method: 'delete',
  request: {
    params: IdParamsSchema,
  },
  tags,
  responses: {
    [httpStatusCodes.NO_CONTENT]: {
      description: 'Item deleted',
    },
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent (
      createErrorSchema(IdParamsSchema),
      'Invalid Id error',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent (
      z.object({
        message: z.string(),
      }).openapi({
        example: {
          message: 'Item not found',
        },
      }),
      'Item not found',
    ),
  },
})

export type ListRoute = typeof listOfItems

export type CreateRoute = typeof createItem

export type GetOneRoute = typeof getItem

export type PatchRoute = typeof patch

export type DeleteRoute = typeof remove
