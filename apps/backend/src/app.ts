import type { AppOpenAPI } from "./lib/types/app-types";
import createApp from "@/lib/create-app";
import configureOpenAPI from "@/lib/openapi-configuration";
import auditLog from "@/routes/audit-log";
import auth from "@/routes/auth/auth.index";
import candidates from "@/routes/candidates";
import elections from "@/routes/elections";
import parties from "@/routes/parties";
import profile from "@/routes/profile";
import users from "@/routes/users";
import votes from "@/routes/votes";
import adminStats from "@/routes/admin-stats";
import health from "@/routes/health";
import { isNavigationRequest } from "@/middleware/utils/navigation";

const app = createApp();

app.use("*", async (c, next) => {
  const isNavigation = isNavigationRequest({
    method: c.req.method,
    path: c.req.path,
    accept: c.req.header("Accept"),
    secFetchMode: c.req.header("Sec-Fetch-Mode"),
  });

  if (isNavigation && c.env?.ASSETS) {
    const url = new URL(c.req.url);
    url.pathname = "/";
    const assetResponse = await c.env.ASSETS.fetch(new Request(url, c.req.raw));

    if (assetResponse.status !== 404) {
      return assetResponse;
    }
  }

  await next();
});

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
