import { listElectionAudit, listPositionAudit } from "@/handlers/audit-log/audit-log.handler";
import {
  createElectionHandler,
  extendElectionHandler,
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
  reorderPositionsHandler,
  updatePositionHandler,
} from "@/handlers/elections/positions.handler";
import { getElectionResultsHandler } from "@/handlers/elections/results.handler";
import { getVotingStateHandler } from "@/handlers/elections/voting-state.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth, withAdmin } from "@/middleware/auth";
import { getElectionAuditRoute, getPositionAuditRoute } from "./audit.routes";
import {
  createPositionRoute,
  deletePositionRoute,
  listPositionsRoute,
  reorderPositionsRoute,
  updatePositionRoute,
} from "./positions.routes";
import { getElectionResultsRoute } from "./results.routes";
import { votingStateRoute } from "./voting-state.routes";
import {
  createElectionRoute,
  extendElectionRoute,
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

// ── Mutation routes (Admin-guarded via withAdmin seam) ───────────────────
router.openapi(createElectionRoute, withAdmin(createElectionHandler));
router.openapi(updateElectionRoute, withAdmin(updateElectionHandler));
router.openapi(transitionElectionRoute, withAdmin(transitionElectionHandler));
router.openapi(extendElectionRoute, withAdmin(extendElectionHandler));
router.openapi(createPositionRoute, withAdmin(createPositionHandler));
router.openapi(updatePositionRoute, withAdmin(updatePositionHandler));
router.openapi(reorderPositionsRoute, withAdmin(reorderPositionsHandler));
router.openapi(deletePositionRoute, withAdmin(deletePositionHandler));

// ── Audit routes (Admin-guarded via withAdmin seam) ──────────────────────
router.openapi(getElectionAuditRoute, withAdmin(listElectionAudit));
router.openapi(getPositionAuditRoute, withAdmin(listPositionAudit));

export default router;
