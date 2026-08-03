import type { AppOpenAPI } from "./lib/types/app-types";
import createApp from "@/lib/create-app";
import configureOpenAPI from "@/lib/openapi-configuration";
import auditLog from "@/routes/audit-log";
import auth from "@/routes/auth/auth.index";
import candidates from "@/routes/candidates";
import elections from "@/routes/elections";
import health from "@/routes/health";
import parties from "@/routes/parties";
import profile from "@/routes/profile";
import users from "@/routes/users";
import votes from "@/routes/votes";
import adminStats from "@/routes/admin-stats";

const app = createApp();

const routes = [
  health,
  auth,
  profile,
  users,
  candidates,
  votes,
  auditLog,
  elections,
  parties,
  adminStats,
];

configureOpenAPI(app as AppOpenAPI);

routes.forEach((route) => {
  app.route("/", route);
});

export default app;
