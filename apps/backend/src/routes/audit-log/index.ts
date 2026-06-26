import * as handlers from "@/handlers/audit-log/audit-log.handler";
import { createRouter } from "@/lib/create-app";
import * as routes from "./routes";

/**
 * Sub-router for the global audit-log read API.
 *
 * All routes here are admin-only. The admin guard is applied *inside* the
 * handler (`c.var.authUser?.role !== "admin"` short-circuit) rather than via
 * a per-route middleware on `.openapi(...)`. Hono's typed `OpenAPIHono.openapi`
 * overloads do not include a `routeDef + middleware + handler` signature, so
 * attaching `requireAdmin` between the route def and the handler causes a
 * `TS2345` mismatch. The in-handler guard mirrors the pattern used in
 * `apps/backend/src/handlers/elections/elections.handler.ts`.
 *
 * We intentionally do not use `router.use("/audit-log/*", requireAdmin)`
 * either: in the Cloudflare Workers runtime, the `*` prefix can incorrectly
 * match sibling sub-routes mounted under similar prefixes (see the comment
 * in `routes/elections/index.ts:50`).
 */
const router = createRouter();

router.openapi(routes.listAuditLogRoute, handlers.listAuditLog);

export default router;
