import * as handlers from "@/handlers/admin-stats/admin-stats.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";
import * as routes from "./routes";

const router = createRouter();
router.use("/admin/stats", requireAuth);

router.openapi(routes.getAdminStatsRoute, handlers.getAdminStats);

export default router;
