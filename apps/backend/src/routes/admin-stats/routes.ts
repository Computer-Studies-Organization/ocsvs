import { createRoute, z } from "@hono/zod-openapi";
import { AdminStatsSchema } from "@/database/openapi-schemas";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorSchema = z.object({ message: z.string() });

export const getAdminStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  tags: ["Admin Stats"],
  summary: "Get system stats and active election turnout (admin only)",
  security: [{ sessionAuth: [] }],
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      AdminStatsSchema,
      "Unified system statistics and turnout details",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(ErrorSchema, ERROR_MESSAGES.UNAUTHORIZED),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
  },
});
