import * as handlers from "@/handlers/users/users.handler";
import { createRouter } from "@/lib/create-app";
import { requireAdmin, requireAuth } from "@/middleware/auth";
import {
  deleteUserRoute,
  getUserRoute,
  listUsersRoute,
  restoreUserRoute,
  updateUserRoute,
} from "./routes";

const router = createRouter();
router.use("*", requireAuth);
router.use("/users", requireAdmin);
router.use("/users/*", requireAdmin);
router.openapi(listUsersRoute, handlers.listUsers);
router.openapi(getUserRoute, handlers.getUser);
router.openapi(updateUserRoute, handlers.updateUser);
router.openapi(deleteUserRoute, handlers.deleteUser);
router.openapi(restoreUserRoute, handlers.restoreUser);

export default router;
