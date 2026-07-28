import * as handlers from "@/handlers/audit-log/audit-log.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth, withAdmin } from "@/middleware/auth";
import * as routes from "./routes";

/**
 * Sub-router for the global audit-log read API.
 * Admin access is enforced at the route definition seam via `withAdmin`.
 */
const router = createRouter();
router.use("/audit-log", requireAuth);

router.openapi(routes.listAuditLogRoute, withAdmin(handlers.listAuditLog));

export default router;
