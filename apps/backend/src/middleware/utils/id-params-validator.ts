import { z } from '@hono/zod-openapi'

/**
 * Zod schema for validating ID parameters in URL paths.
 * 
 * This schema validates and coerces path parameters named 'id' to numbers.
 * It's commonly used in REST API routes that require numeric identifiers
 * (e.g., /items/{id}, /users/{id}).
 * 
 * Features:
 * - Automatically coerces string path parameters to numbers
 * - Includes OpenAPI documentation metadata
 * - Provides example value for API documentation
 * - Marks the parameter as required in the path
 * 
 * @example
 * ```typescript
 * // In a route definition
 * export const getItem = createRoute({
 *   path: '/items/{id}',
 *   method: 'get',
 *   request: {
 *     params: IdParamsSchema,
 *   },
 *   // ... rest of route config
 * })
 * ```
 * 
 * Expected URL format: `/items/42` where `42` will be validated and converted to number
 */
const IdParamsSchema = z.object({
  id: z.coerce.number().openapi({
    param: {
      name: 'id',
      in: 'path',
      required: true,
    },
    required: ['id'],
    example: 42,
  }),
})

export default IdParamsSchema
