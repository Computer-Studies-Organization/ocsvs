import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { Environment } from "@/middleware/env";

export interface AuthUser {
  id: string;
  email: string | null;
  username: string;
  role: string;
}

export interface AppBindings {
  Bindings: Environment & Omit<CloudflareBindings, keyof Environment>;
  Variables: {
    logger: PinoLogger;
    authUser: AuthUser;
  };
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
