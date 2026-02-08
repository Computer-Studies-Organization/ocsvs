import { Environment } from "@/middleware/env";
import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

export interface AppBindings {
  Bindings: Environment & Omit<Env, keyof Environment>;
  Variables: {
    logger: PinoLogger;
  };
}

// export interface Env {
//   DB: D1Database;
// }

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>;
