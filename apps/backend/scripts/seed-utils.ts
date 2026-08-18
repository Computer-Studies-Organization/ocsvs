import { isLocalDatabaseUrl } from "../src/middleware/env";

type SeedEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * Returns a database URL only when seeding is explicitly safe for the target.
 * Production is always refused; non-local targets require an explicit opt-in.
 */
export function getSeedDatabaseUrl(env: SeedEnvironment = process.env): string {
  const url = env.TURSO_DATABASE_URL?.trim();

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required");
  }

  if (env.NODE_ENV?.toLowerCase() === "production") {
    throw new Error("Refusing to seed while NODE_ENV=production");
  }

  if (!isLocalDatabaseUrl(url) && env.ALLOW_REMOTE_SEEDING !== "true") {
    throw new Error(
      "Remote database seeding is disabled; set ALLOW_REMOTE_SEEDING=true for a non-production target",
    );
  }

  return url;
}

export function getSeedPassword(env: SeedEnvironment, variableName: string): string {
  const password = env[variableName];

  if (!password) {
    throw new Error(`${variableName} is required`);
  }

  return password;
}
