import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/database/schema";

const OFFLINE_DATABASE_URL = "http://127.0.0.1:8080";
const OFFLINE_DATABASE_TOKEN = "offline-local-token";
const MIGRATIONS_DIR = resolve("src/database/migrations");
const MIGRATION_WITH_TEMP_TABLES = "0016_needy_skreet.sql";

export function rewriteOfflineMigration(sql: string) {
  const rewritten = sql.replaceAll("CREATE TEMP TABLE", "CREATE TABLE");
  const replacements = (sql.match(/CREATE TEMP TABLE/g) ?? []).length;

  if (replacements !== 2) {
    throw new Error(
      `${MIGRATION_WITH_TEMP_TABLES} changed: expected 2 temporary tables, found ${replacements}`,
    );
  }

  return rewritten;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Offline migrations are not allowed in production");
  }

  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL !== OFFLINE_DATABASE_URL) {
    throw new Error(`Offline migrations require TURSO_DATABASE_URL=${OFFLINE_DATABASE_URL}`);
  }

  const temporaryMigrationsDir = await mkdtemp(join(tmpdir(), "ocsvs-offline-migrations-"));
  const migrationPath = join(temporaryMigrationsDir, MIGRATION_WITH_TEMP_TABLES);
  const sourceMigrationPath = join(MIGRATIONS_DIR, MIGRATION_WITH_TEMP_TABLES);

  try {
    await cp(MIGRATIONS_DIR, temporaryMigrationsDir, { recursive: true });
    await writeFile(
      migrationPath,
      rewriteOfflineMigration(await readFile(sourceMigrationPath, "utf8")),
    );

    const client = createClient({
      url: OFFLINE_DATABASE_URL,
      authToken: OFFLINE_DATABASE_TOKEN,
    });

    try {
      await migrate(drizzle(client, { schema }), {
        migrationsFolder: temporaryMigrationsDir,
      });
    } finally {
      client.close();
    }
  } finally {
    await rm(temporaryMigrationsDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Offline migration failed:", err);
  process.exit(1);
});
