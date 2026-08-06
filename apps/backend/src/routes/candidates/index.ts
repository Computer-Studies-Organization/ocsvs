import * as auditHandlers from "@/handlers/audit-log/audit-log.handler";
import * as handlers from "@/handlers/candidates/candidates.handler";
import * as imageHandlers from "@/handlers/candidates/image.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth, withAdmin } from "@/middleware/auth";
import { getCandidateAuditRoute } from "./audit.routes";
import {
  createCandidateRoute,
  deleteCandidateRoute,
  deleteImageRoute,
  getCandidateImageRoute,
  getCandidateRoute,
  listCandidatesRoute,
  updateCandidateRoute,
  uploadImageRoute,
} from "./routes";

const router = createRouter();

// Apply authentication middleware to candidate routes
router.use("/candidates/*", requireAuth);

// Register routes with handlers
router.openapi(createCandidateRoute, withAdmin(handlers.createCandidate));
router.openapi(listCandidatesRoute, handlers.listCandidates);
router.openapi(getCandidateRoute, handlers.getCandidate);
router.openapi(updateCandidateRoute, withAdmin(handlers.updateCandidate));
router.openapi(deleteCandidateRoute, withAdmin(handlers.deleteCandidate));
router.openapi(uploadImageRoute, withAdmin(imageHandlers.uploadImage));
router.openapi(deleteImageRoute, withAdmin(imageHandlers.deleteImage));
router.openapi(getCandidateImageRoute, imageHandlers.getCandidateImage);

// ── Audit routes (Admin-guarded via withAdmin seam) ──────────────────────
router.openapi(getCandidateAuditRoute, withAdmin(auditHandlers.listCandidateAudit));

export default router;
