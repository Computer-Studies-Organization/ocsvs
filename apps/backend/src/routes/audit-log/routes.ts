import { createRoute, z } from "@hono/zod-openapi";
import { AuditLogListResponse } from "@/database/openapi-schemas";
import { AUDIT_ACTIONS, TARGET_TYPES } from "@/lib/constants/audit-actions";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorSchema = z.object({ message: z.string() });

/**
 * Query schema for the global audit-log list endpoint.
 *
 * All fields are optional. Numeric filters (`since`, `until`, `limit`) use
 * `z.coerce.number()` because query strings arrive as strings; the repo
 * additionally clamps `limit` to the [1, 200] range with a default of 50.
 *
 * `action` and `targetType` are narrowed to the Zod enums from
 * `@/lib/constants/audit-actions` so out-of-vocabulary values are rejected
 * at the route boundary with a 422 rather than silently returning an
 * empty page. `.options` is the Zod enum's `[string, ...string[]]` tuple —
 * keeping the route schema in lockstep with the constants file.
 */
export const AuditLogQuerySchema = z.object({
  actorId: z.string().optional(),
  action: z.enum(AUDIT_ACTIONS.options).optional(),
  targetType: z.enum(TARGET_TYPES.options).optional(),
  targetId: z.string().optional(),
  since: z.coerce.number().int().positive().optional(),
  until: z.coerce.number().int().positive().optional(),
  cursor: z.string().optional(),
  // `.default(50)` already implies `.optional()` for input parsing; combining
  // `.default().optional()` causes the field to be omitted from the output when
  // not supplied (because `.optional()` widens the output type to `T | undefined`).
  // Keeping only `.default(50)` so the schema output includes `limit: 50` when the
  // query string omits the param — which is the contract the read API expects.
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listAuditLogRoute = createRoute({
  method: "get",
  path: "/audit-log",
  tags: ["Audit Log"],
  summary: "List audit log entries (admin only)",
  security: [{ sessionAuth: [] }],
  request: {
    query: AuditLogQuerySchema,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      AuditLogListResponse,
      "Audit log entries for the current page",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(ErrorSchema, ERROR_MESSAGES.UNAUTHORIZED),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
  },
});
