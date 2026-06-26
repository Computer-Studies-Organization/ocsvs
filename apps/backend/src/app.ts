import type { AppOpenAPI } from "./lib/types/app-types";
import createApp from "@/lib/create-app";
import configureOpenAPI from "@/lib/openapi-configuration";
import auditLog from "@/routes/audit-log";
import auth from "@/routes/auth/auth.index";
import candidates from "@/routes/candidates";
import elections from "@/routes/elections";
import index from "@/routes/index.route";
import profile from "@/routes/profile";
import users from "@/routes/users";
import votes from "@/routes/votes";

const app = createApp();

const routes = [index, auth, profile, users, candidates, votes, auditLog, elections];

configureOpenAPI(app as AppOpenAPI);

routes.forEach((route) => {
  app.route("/", route);
});

app.get("/", (c) => {
  c.var.logger.info("Root endpoint accessed");
  return c.text("Hello Hono!");
});

export default app;
