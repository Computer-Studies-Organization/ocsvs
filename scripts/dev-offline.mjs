import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const databaseUrl = "http://127.0.0.1:8080";
const databaseHealthUrl = `${databaseUrl}/health`;
const databaseFile = resolve(root, "apps/backend/local.db");
const children = [];
let databaseProcess;
let stopping = false;

async function databaseIsReady() {
  try {
    const response = await fetch(databaseHealthUrl, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    if (await databaseIsReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Local Turso server is unavailable at ${databaseUrl}. Start it with: turso dev --db-file apps/backend/local.db --port 8080`,
  );
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  databaseProcess?.kill("SIGTERM");
  process.exit(code);
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());

try {
  if (!(await databaseIsReady())) {
    databaseProcess = spawn("turso", ["dev", "--db-file", databaseFile, "--port", "8080"], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    databaseProcess.once("error", (error) => {
      console.error(`Unable to start local Turso: ${error.message}`);
      stop(1);
    });
  }

  await waitForDatabase();
  execFileSync("pnpm", ["--filter", "@cso-voting/backend", "db:migrate:offline"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  const frontendEnv = {
    ...process.env,
    PUBLIC_API_BASE_URL: "http://localhost:8787",
    PUBLIC_OFFLINE_DEV: "true",
    PUBLIC_SENTRY_DSN: "",
  };
  const frontend = spawn("pnpm", ["--filter", "@cso-voting/frontend", "dev"], {
    cwd: root,
    env: frontendEnv,
    stdio: "inherit",
  });
  const backend = spawn(
    "pnpm",
    [
      "--filter",
      "@cso-voting/backend",
      "exec",
      "wrangler",
      "dev",
      "--env",
      "offline",
      "--port",
      "8787",
    ],
    { cwd: root, env: process.env, stdio: "inherit" },
  );
  children.push(frontend, backend);

  for (const child of children) {
    child.once("error", (error) => {
      console.error(error.message);
      stop(1);
    });
    child.once("exit", (code) => stop(code ?? 1));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  stop(1);
}
