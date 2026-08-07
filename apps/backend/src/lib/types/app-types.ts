import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";
import type { Database } from "@/database/repositories/database.type";
import type { Environment } from "@/middleware/env";
import type { UserRole } from "@/lib/user-lifecycle-coordinator";

export interface AuthUser {
  id: string;
  email: string | null;
  username: string;
  role: UserRole;
}

export interface AppBindings {
  Bindings: Environment & Omit<CloudflareBindings, keyof Environment>;
  Variables: {
    logger: PinoLogger;
    authUser: AuthUser;
    db: Database;
  };
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
