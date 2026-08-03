const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
type SeedEnvironment = Readonly<Record<string, string | undefined>>;

function isLocalDatabaseUrl(url: string): boolean {
  if (url === ":memory:" || url.startsWith("file:")) {
    return true;
  }

  try {
    const parsed = new URL(url);
    return LOCAL_DATABASE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

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
