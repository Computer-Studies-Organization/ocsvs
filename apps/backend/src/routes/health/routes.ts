import { createRoute, z } from "@hono/zod-openapi";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Check Worker availability",
  responses: {
    [httpStatusCodes.OK]: jsonContent(HealthResponseSchema, "Worker is healthy"),
  },
});
