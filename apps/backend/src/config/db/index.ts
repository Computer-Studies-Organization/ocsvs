import type { Context } from "hono";
import type { AppBindings } from "@/lib/types/app-types";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/database/schema";

export function createDb(c: Context<AppBindings>) {
  const cachedDb = c.get("db");
  if (cachedDb) return { db: cachedDb };

  const url = c.env.TURSO_DATABASE_URL;
  const authToken = c.env.TURSO_AUTH_TOKEN;

  if (!url) throw new Error("TURSO_DATABASE_URL is required");

  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  c.set("db", db);

  return { db };
}
