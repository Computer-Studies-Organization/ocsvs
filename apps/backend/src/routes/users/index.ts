import { createRouter } from "@/lib/create-app";
import * as handlers from "@/handlers/users/users.handler";
import { listUsersRoute } from "./routes";
import { requireAuth } from "@/middleware/auth";

const router = createRouter()
router.use("*", requireAuth)
router.openapi(listUsersRoute, handlers.listUsers);

export default router;