import { listElectionAudit, listPositionAudit } from "@/handlers/audit-log/audit-log.handler";
import {
  createElectionHandler,
  getCurrentElectionHandler,
  getElectionHandler,
  listElectionsHandler,
  transitionElectionHandler,
  updateElectionHandler,
} from "@/handlers/elections/elections.handler";
import {
  createPositionHandler,
  deletePositionHandler,
  listPositionsHandler,
  updatePositionHandler,
} from "@/handlers/elections/positions.handler";
import { getElectionResultsHandler } from "@/handlers/elections/results.handler";
import { getVotingStateHandler } from "@/handlers/elections/voting-state.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";
import { getElectionAuditRoute, getPositionAuditRoute } from "./audit.routes";
import {
  createPositionRoute,
  deletePositionRoute,
  listPositionsRoute,
  updatePositionRoute,
} from "./positions.routes";
import { getElectionResultsRoute } from "./results.routes";
import { votingStateRoute } from "./voting-state.routes";
import {
  createElectionRoute,
  getCurrentElectionRoute,
  getElectionRoute,
  listElectionsRoute,
  transitionElectionRoute,
  updateElectionRoute,
} from "./routes";

const router = createRouter();

// ── Auth for all election routes ──────────────────────────────────────────
router.use("/elections/*", requireAuth);

// ── Read routes ───────────────────────────────────────────────────────────
router.openapi(listElectionsRoute, listElectionsHandler);
router.openapi(getCurrentElectionRoute, getCurrentElectionHandler);
router.openapi(votingStateRoute, getVotingStateHandler);
router.openapi(getElectionRoute, getElectionHandler);
router.openapi(getElectionResultsRoute, getElectionResultsHandler);
router.openapi(listPositionsRoute, listPositionsHandler);

// ── Mutation routes ───────────────────────────────────────────────────────
// Admin checks live in the handlers (c.var.authUser?.role !== 'admin').
// requireAdmin is NOT used here because router.use() is prefix-match in the
// Cloudflare Workers runtime, which incorrectly blocks GET sub-routes.
router.openapi(createElectionRoute, createElectionHandler);
router.openapi(updateElectionRoute, updateElectionHandler);
router.openapi(transitionElectionRoute, transitionElectionHandler);
router.openapi(createPositionRoute, createPositionHandler);
router.openapi(updatePositionRoute, updatePositionHandler);
router.openapi(deletePositionRoute, deletePositionHandler);

// ── Audit routes ──────────────────────────────────────────────────────────
// Admin guard lives in the handler (see step-6 audit-log.handler.ts).
router.openapi(getElectionAuditRoute, listElectionAudit);
router.openapi(getPositionAuditRoute, listPositionAudit);

export default router;
