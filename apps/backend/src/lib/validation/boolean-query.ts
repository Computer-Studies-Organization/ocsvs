import { z } from "@hono/zod-openapi";

export const booleanQuery = z.enum(["true", "false"]).transform((v) => v === "true");
