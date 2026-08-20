import { z } from "@hono/zod-openapi";

const validationErrorSchema = z.object({
  success: z.boolean().openapi({
    example: false,
  }),
  error: z
    .object({
      issues: z.array(
        z.object({
          code: z.string(),
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string().optional(),
        }),
      ),
      name: z.string(),
    })
    .openapi({
      example: {
        issues: [
          {
            code: "invalid_type",
            path: ["name"],
            message: "Expected string, received number",
          },
        ],
        name: "ZodError",
      },
    }),
});

export default validationErrorSchema;
