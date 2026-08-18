import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { expand } from "dotenv-expand";

export const DUMMY_TURNSTILE_SITEKEY = "1x00000000000000000000AA";

export interface FrontendBuildEnv {
  apiBaseUrl: string;
  turnstileSitekey: string;
  offlineDev: boolean;
}

interface LoadFrontendBuildEnvOptions {
  frontendDir?: string;
  mode?: string;
  processEnv?: Partial<NodeJS.ProcessEnv>;
}

const DEFAULT_FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../frontend");

export function loadFrontendBuildEnv({
  frontendDir = DEFAULT_FRONTEND_DIR,
  mode = "production",
  processEnv = process.env,
}: LoadFrontendBuildEnvOptions = {}): FrontendBuildEnv {
  const parsedEnv: Record<string, string> = {};
  const envFiles = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];

  for (const envFile of envFiles) {
    const envPath = join(frontendDir, envFile);
    if (existsSync(envPath)) {
      Object.assign(parsedEnv, parse(readFileSync(envPath)));
    }
  }

  const explicitProcessEnv = Object.fromEntries(
    Object.entries(processEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  const expandedEnv = expand({
    parsed: parsedEnv,
    processEnv: { ...explicitProcessEnv },
  }).parsed;
  const resolvedEnv = { ...expandedEnv, ...explicitProcessEnv };

  return {
    apiBaseUrl: resolvedEnv.PUBLIC_API_BASE_URL ?? "",
    turnstileSitekey: resolvedEnv.PUBLIC_TURNSTILE_SITEKEY ?? "",
    offlineDev: resolvedEnv.PUBLIC_OFFLINE_DEV === "true",
  };
}

export function validateFrontendBuildEnv({
  apiBaseUrl,
  turnstileSitekey,
  offlineDev = false,
}: FrontendBuildEnv): void {
  if (offlineDev) {
    throw new Error("PUBLIC_OFFLINE_DEV is not allowed in production builds");
  }

  if (apiBaseUrl !== "") {
    throw new Error("PUBLIC_API_BASE_URL must be empty for same-origin production builds");
  }

  if (!turnstileSitekey || turnstileSitekey === DUMMY_TURNSTILE_SITEKEY) {
    throw new Error("PUBLIC_TURNSTILE_SITEKEY must be a real production site key");
  }
}

if (process.argv[1]?.endsWith("validate-frontend-build-env.ts")) {
  try {
    validateFrontendBuildEnv(loadFrontendBuildEnv());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
