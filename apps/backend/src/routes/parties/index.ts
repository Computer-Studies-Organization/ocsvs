import * as handlers from "@/handlers/parties/parties.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth, withAdmin } from "@/middleware/auth";
import {
  createPartyListRoute,
  deletePartyListRoute,
  listPartyListsRoute,
  updatePartyListRoute,
} from "./parties.routes";

const router = createRouter();

router.use("/elections/*", requireAuth);

router.openapi(listPartyListsRoute, handlers.listPartyListsHandler);
router.openapi(createPartyListRoute, withAdmin(handlers.createPartyListHandler));
router.openapi(updatePartyListRoute, withAdmin(handlers.updatePartyListHandler));
router.openapi(deletePartyListRoute, withAdmin(handlers.deletePartyListHandler));

export default router;
