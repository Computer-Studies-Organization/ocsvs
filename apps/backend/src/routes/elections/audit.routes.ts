import { createRoute, z } from "@hono/zod-openapi";
import { AuditLogEntrySchema } from "@/database/openapi-schemas";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorSchema = z.object({ message: z.string() });
const ElectionIdParams = z.object({ id: z.string() });
const PositionIdParams = z.object({ id: z.string(), positionId: z.string() });

/**
 * GET /elections/{id}/audit — full audit trail for a single election.
 * Gated by `requireAdmin` at the registration site in step 7.
 */
export const getElectionAuditRoute = createRoute({
  method: "get",
  path: "/elections/{id}/audit",
  tags: ["Elections", "Audit Log"],
  summary: "Get audit trail for an election (admin only)",
  security: [{ sessionAuth: [] }],
  request: {
    params: ElectionIdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({ items: z.array(AuditLogEntrySchema) }),
      "Audit log entries for the election",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(ErrorSchema, ERROR_MESSAGES.UNAUTHORIZED),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
  },
});

/**
 * GET /elections/{id}/positions/{positionId}/audit — full audit trail for a
 * single position nested under its parent election.
 */
export const getPositionAuditRoute = createRoute({
  method: "get",
  path: "/elections/{id}/positions/{positionId}/audit",
  tags: ["Positions", "Audit Log"],
  summary: "Get audit trail for a position (admin only)",
  security: [{ sessionAuth: [] }],
  request: {
    params: PositionIdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({ items: z.array(AuditLogEntrySchema) }),
      "Audit log entries for the position",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(ErrorSchema, ERROR_MESSAGES.UNAUTHORIZED),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
  },
});
