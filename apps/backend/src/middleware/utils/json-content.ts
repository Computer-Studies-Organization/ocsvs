import type { z } from "@hono/zod-openapi";

/** Wrap a Zod schema as JSON content for an OpenAPI response. */
function jsonContent<T extends z.ZodTypeAny>(schema: T, description: string) {
  return {
    content: {
      "application/json": {
        schema,
      },
    },
    description,
  };
}

export default jsonContent;

/** Wrap a Zod schema as required JSON content for an OpenAPI request body. */
export function jsonContentRequired<T extends z.ZodTypeAny>(schema: T, description: string) {
  return {
    ...jsonContent(schema, description),
    required: true,
  };
}
