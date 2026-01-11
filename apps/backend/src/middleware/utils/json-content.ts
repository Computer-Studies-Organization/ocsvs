import type { ZodSchema } from '@/lib/types/zod-types'

/**
 * Creates a JSON content object for OpenAPI response definitions.
 * 
 * This utility function standardizes the creation of JSON response schemas
 * for OpenAPI documentation. It wraps a Zod schema with the appropriate
 * content-type metadata for JSON responses.
 * 
 * @template T - The Zod schema type
 * @param schema - The Zod schema defining the response structure
 * @param description - Human-readable description of the response
 * @returns OpenAPI content object with JSON media type and schema
 * 
 * @example
 * ```typescript
 * // In a route definition
 * responses: {
 *   [httpStatusCodes.OK]: jsonContent(
 *     z.array(apiItemsSchema),
 *     'List of items'
 *   )
 * }
 * ```
 */
function jsonContent<
  T extends ZodSchema,
>(schema: T, description: string) {
  return {
    content: {
      'application/json': {
        schema,
      },
    },
    description,
  }
}

export default jsonContent

/**
 * Creates a required JSON content object for OpenAPI request body definitions.
 * 
 * Similar to `jsonContent`, but marks the content as required. This is typically
 * used for request bodies where the JSON payload is mandatory.
 * 
 * @template T - The Zod schema type
 * @param schema - The Zod schema defining the request body structure
 * @param description - Human-readable description of the request body
 * @returns OpenAPI content object with JSON media type, schema, and required flag
 * 
 * @example
 * ```typescript
 * // In a route definition
 * request: {
 *   body: jsonContentRequired(
 *     insertItemApiSchema,
 *     'The item to create'
 *   )
 * }
 * ```
 */
export function jsonContentRequired<
  T extends ZodSchema,
>(schema: T, description: string) {
  return {
    ...jsonContent(schema, description),
    required: true,
  }
}
