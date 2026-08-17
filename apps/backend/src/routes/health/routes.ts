import { createRoute, z } from "@hono/zod-openapi";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

const ReadinessUnavailableSchema = z.object({
  status: z.literal("unavailable"),
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

export const readinessRoute = createRoute({
  method: "get",
  path: "/health/ready",
  tags: ["Health"],
  summary: "Check Worker dependencies",
  responses: {
    [httpStatusCodes.OK]: jsonContent(HealthResponseSchema, "Worker dependencies are ready"),
    [httpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
      ReadinessUnavailableSchema,
      "A Worker dependency is unavailable",
    ),
  },
});
