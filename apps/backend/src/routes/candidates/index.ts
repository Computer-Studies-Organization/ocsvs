import * as auditHandlers from "@/handlers/audit-log/audit-log.handler";
import * as handlers from "@/handlers/candidates/candidates.handler";
import * as imageHandlers from "@/handlers/candidates/image.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";
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
router.use("/candidates", requireAuth);
router.use("/candidates/*", requireAuth);

// Register routes with handlers
router.openapi(createCandidateRoute, handlers.createCandidate);
router.openapi(listCandidatesRoute, handlers.listCandidates);
router.openapi(getCandidateRoute, handlers.getCandidate);
router.openapi(updateCandidateRoute, handlers.updateCandidate);
router.openapi(deleteCandidateRoute, handlers.deleteCandidate);
router.openapi(uploadImageRoute, imageHandlers.uploadImage);
router.openapi(deleteImageRoute, imageHandlers.deleteImage);
router.openapi(getCandidateImageRoute, imageHandlers.getCandidateImage);

// ── Audit routes ──────────────────────────────────────────────────────────
// Admin guard lives in the handler (see step-6 audit-log.handler.ts).
router.openapi(getCandidateAuditRoute, auditHandlers.listCandidateAudit);

export default router;
