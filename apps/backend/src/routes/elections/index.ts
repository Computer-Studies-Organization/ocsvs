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
import { createRouter } from "@/lib/create-app";
import { requireAdmin, requireAuth } from "@/middleware/auth";
import {
  createPositionRoute,
  deletePositionRoute,
  listPositionsRoute,
  updatePositionRoute,
} from "./positions.routes";
import { getElectionResultsRoute } from "./results.routes";
import {
  createElectionRoute,
  getCurrentElectionRoute,
  getElectionRoute,
  listElectionsRoute,
  transitionElectionRoute,
  updateElectionRoute,
} from "./routes";

const router = createRouter();

router.use("/elections/*", requireAuth);

router.openapi(listElectionsRoute, listElectionsHandler);

router.use("/elections", requireAdmin);
router.openapi(createElectionRoute, createElectionHandler);

router.use("/elections/current", requireAuth);
router.openapi(getCurrentElectionRoute, getCurrentElectionHandler);

router.use("/elections/:id", requireAuth);
router.openapi(getElectionRoute, getElectionHandler);

router.use("/elections/:id", requireAdmin);
router.openapi(updateElectionRoute, updateElectionHandler);

router.use("/elections/:id/transitions", requireAdmin);
router.openapi(transitionElectionRoute, transitionElectionHandler);

router.use("/elections/:id/results", requireAuth);
router.openapi(getElectionResultsRoute, getElectionResultsHandler);

router.use("/elections/:id/positions", requireAuth);
router.openapi(listPositionsRoute, listPositionsHandler);

router.use("/elections/:id/positions", requireAdmin);
router.openapi(createPositionRoute, createPositionHandler);
router.openapi(updatePositionRoute, updatePositionHandler);
router.openapi(deletePositionRoute, deletePositionHandler);

export default router;
