import { createRoute, z } from "@hono/zod-openapi";
import { AuditLogEntrySchema } from "@/database/openapi-schemas";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorSchema = z.object({ message: z.string() });
const IdParams = z.object({ id: z.string() });

/**
 * GET /candidates/{id}/audit — full audit trail for a single candidate.
 * Gated by `requireAdmin` at the registration site in step 7.
 */
export const getCandidateAuditRoute = createRoute({
  method: "get",
  path: "/candidates/{id}/audit",
  tags: ["Candidates", "Audit Log"],
  summary: "Get audit trail for a candidate (admin only)",
  security: [{ sessionAuth: [] }],
  request: {
    params: IdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({ items: z.array(AuditLogEntrySchema) }),
      "Audit log entries for the candidate",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(ErrorSchema, ERROR_MESSAGES.UNAUTHORIZED),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
  },
});
