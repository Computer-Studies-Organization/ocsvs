import * as auditHandlers from "@/handlers/audit-log/audit-log.handler";
import * as handlers from "@/handlers/users/users.handler";
import { createRouter } from "@/lib/create-app";
import { requireAdmin, requireAuth, withAdmin } from "@/middleware/auth";
import { getUserAuditRoute } from "./audit.routes";
import {
  createUserRoute,
  deleteUserRoute,
  getUserRoute,
  hardDeleteUserRoute,
  importUsersRoute,
  listUsersRoute,
  restoreUserRoute,
  updateUserRoute,
  unlockUserRoute,
  resetUserPasswordRoute,
} from "./routes";

const router = createRouter();
router.use("/users/*", requireAuth);
router.use("/users/*", requireAdmin);
router.openapi(listUsersRoute, handlers.listUsers);
router.openapi(getUserRoute, handlers.getUser);
router.openapi(createUserRoute, handlers.createUser);
router.openapi(importUsersRoute, handlers.importUsers);
router.openapi(updateUserRoute, handlers.updateUser);
router.openapi(deleteUserRoute, handlers.deleteUser);
router.openapi(restoreUserRoute, handlers.restoreUser);
router.openapi(hardDeleteUserRoute, handlers.hardDeleteUser);
router.openapi(unlockUserRoute, handlers.unlockUser);
router.openapi(resetUserPasswordRoute, withAdmin(handlers.resetUserPassword));

// ── Audit routes ──────────────────────────────────────────────────────────
// Admin guard is enforced by the `requireAdmin` middleware above and
// re-checked in the handler (defense in depth, see step-6 handler file).
router.openapi(getUserAuditRoute, auditHandlers.listUserAudit);

export default router;
