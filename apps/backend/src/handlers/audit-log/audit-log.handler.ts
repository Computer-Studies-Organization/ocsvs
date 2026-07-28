import type { RouteConfig } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppBindings, AppRouteHandler } from "@/lib/types/app-types";
import type { listAuditLogRoute } from "@/routes/audit-log/routes";
import { getCandidateAuditRoute } from "@/routes/candidates/audit.routes";
import { getElectionAuditRoute, getPositionAuditRoute } from "@/routes/elections/audit.routes";
import { getUserAuditRoute } from "@/routes/users/audit.routes";
import { createDb } from "@/config/db";
import { AuditLogEntrySchema } from "@/database/openapi-schemas";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import type { TargetType } from "@/lib/constants/audit-actions";
import * as httpStatusCodes from "@/openapi/http-status-codes";

/**
 * Global paginated list of audit-log entries.
 *
 * The query schema (see `AuditLogQuerySchema` in `@/routes/audit-log/routes`)
 * enforces types/coercions; the repo additionally clamps `limit` and decodes
 * the cursor. Empty filters produce an unfiltered newest-first listing.
 *
 * Admin-only: the in-handler role guard mirrors the pattern in
 * `apps/backend/src/handlers/elections/elections.handler.ts`.
 */
export const listAuditLog: AppRouteHandler<typeof listAuditLogRoute> = async (c) => {
  const filters = c.req.valid("query");
  const { db } = createDb(c);
  const { items, nextCursor } = await auditLogRepo.list(db, filters);
  // `AuditLogRow.targetType` is widened to `string` at the repo boundary
  // (the repo is decoupled from the Zod enum in `@/database/openapi-schemas`).
  // Re-narrow it to the response schema's union via `z.infer` so the route's
  // typed response contract is satisfied.
  return c.json(
    { items: items as Array<z.infer<typeof AuditLogEntrySchema>>, nextCursor },
    httpStatusCodes.OK,
  );
};

/**
 * Per-target audit trail closure. Reads the resource id from path params
 * (each per-target route exposes it as `id` — see the individual
 * `routes/<resource>/audit.routes.ts` files) and combines it with the
 * supplied `targetType` to fetch every entry recorded against that
 * resource.
 *
 * `listByTarget` is intentionally non-paginated; per-resource audit trails
 * are expected to be small (see the method's doc comment in the repository).
 *
 * Admin access is enforced via `withAdmin` at the route definition seam.
 *
 * The generic `R` parameter binds the factory output to a specific route
 * definition so `c.req.valid("param")` resolves the typed `{ id, positionId? }`
 * shape from each per-resource route. Without the generic, the context loses
 * its param key and `c.req.valid("param")` collapses to `never`. The `_route`
 * argument is a type-inference anchor only — the route def is consumed at the
 * wiring site (step 7) and is not referenced inside the closure.
 */
function makeListAuditLogByTarget<R extends RouteConfig>(
  targetType: TargetType,
  _route: R,
): AppRouteHandler<R> {
  return (async (c: Context<AppBindings>) => {
    const params = c.req.param();
    const targetId = targetType === "position" ? params.positionId : params.id;
    const { db } = createDb(c);
    const items = await auditLogRepo.listByTarget(db, targetType, targetId!);
    return c.json(
      { items: items as Array<z.infer<typeof AuditLogEntrySchema>> },
      httpStatusCodes.OK,
    );
  }) as unknown as AppRouteHandler<R>;
}

// Explicit per-resource closures. These will be wired to their respective
// route definitions (see `routes/<resource>/audit.routes.ts`) in step 7.
// TypeScript verifies the route ↔ handler pairing at the `.openapi(...)`
// call site against the specific route definition.
export const listElectionAudit = makeListAuditLogByTarget("election", getElectionAuditRoute);
export const listPositionAudit = makeListAuditLogByTarget("position", getPositionAuditRoute);
export const listCandidateAudit = makeListAuditLogByTarget("candidate", getCandidateAuditRoute);
export const listUserAudit = makeListAuditLogByTarget("user", getUserAuditRoute);
