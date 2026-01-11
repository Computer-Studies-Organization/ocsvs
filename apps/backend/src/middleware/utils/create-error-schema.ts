import type { ZodSchema } from '@/lib/types/zod-types'

import { z } from '@hono/zod-openapi'

/**
 * Creates a standardized error schema for OpenAPI documentation based on Zod validation errors.
 * 
 * This utility generates a consistent error response schema that includes validation issues
 * from Zod schema validation failures. It's primarily used in route definitions to document
 * error responses for invalid request data.
 * 
 * @template T - The Zod schema type to create error schema for
 * @param schema - The Zod schema to generate error documentation from
 * @returns A Zod object schema representing the error response structure
 * 
 * @example
 * ```typescript
 * // In a route definition
 * responses: {
 *   [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
 *     createErrorSchema(insertItemSchema),
 *     'The item is invalid'
 *   )
 * }
 * ```
 * 
 * The returned schema structure:
 * ```typescript
 * {
 *   success: false,
 *   error: {
 *     issues: [
 *       {
 *         code: "invalid_type",
 *         path: ["fieldName"],
 *         message: "Expected string, received number"
 *       }
 *     ],
 *     name: "ZodError"
 *   }
 * }
 * ```
 */
function createErrorSchema<
  T extends ZodSchema,
>(schema: T) {
  const { error: _error } = schema.safeParse(
    schema._def.typeName
    === z.ZodFirstPartyTypeKind.ZodArray
      ? []
      : {},
  )
  return z.object({
    success: z.boolean().openapi({
      example: false,
    }),
    error: z
      .object({
        issues: z.array(
          z.object({
            code: z.string(),
            path: z.array(
              z.union([z.string(), z.number()]),
            ),
            message: z.string().optional(),
          }),
        ),
        name: z.string(),
      })
      .openapi({
        example: {
          issues: [
            {
              code: 'invalid_type',
              path: ['name'],
              message: 'Expected string, received number',
            },
          ],
          name: 'ZodError',
        },
      }),
  })
}

export default createErrorSchema
