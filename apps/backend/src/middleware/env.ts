import { z } from "zod";

/**
 * Environment configuration module with type-safe validation.
 *
 * This module validates Worker environment bindings using Zod schemas,
 * ensuring that the application has all required configuration values
 * with proper types at request time.
 *
 * Features:
 * - Type-safe environment variable access
 * - Automatic type coercion (e.g., string to number for PORT)
 * - Default values for optional variables
 * - Validation with helpful error messages
 * - Process termination on invalid configuration
 *
 * @example
 * ```typescript
 * import env from '@/middleware/env'
 *
 * console.log(env.PORT) // number (default: 3000)
 * console.log(env.NODE_ENV) // string (default: 'development')
 * console.log(env.TURSO_DATABASE_URL) // string (required)
 * console.log(env.TURSO_AUTH_TOKEN) // string (optional)
 * ```
 */

/**
 * Zod schema defining the structure and validation rules for environment variables.
 *
 * Required variables:
 * - TURSO_DATABASE_URL: Must be a non-empty string (supports libSQL URLs, local file paths, or :memory:)
 *
 * Optional variables:
 * - OFFLINE_DEV: Enables the explicit local-only development profile (defaults to false)
 * - TURSO_AUTH_TOKEN: Optional authorization token for Turso
 * - B2_APPLICATION_KEY_ID: Optional Backblaze B2 application key ID (required at runtime for image endpoints)
 * - B2_APPLICATION_KEY: Optional Backblaze B2 application key (required at runtime for image endpoints)
 *
 * Optional variables with defaults:
 * - NODE_ENV: Defaults to 'development'
 * - PORT: Coerced to number, defaults to 3000
 * - LOG_LEVEL: Must be valid pino log level, defaults to 'info'
 */
const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    TURSO_DATABASE_URL: z.string().min(1),
    OFFLINE_DEV: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return val;
    }, z.boolean().default(false)),
    TURSO_AUTH_TOKEN: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
    B2_APPLICATION_KEY_ID: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().optional(),
    ),
    B2_APPLICATION_KEY: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().optional(),
    ),
    B2_PUBLIC_ACCESS: z.preprocess(
      (val) => val === "true" || val === true,
      z.boolean().default(false),
    ),
    TURNSTILE_SECRET_KEY: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().optional(),
    ),
    HMAC_SECRET: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
    PREVIOUS_HMAC_SECRETS: z.preprocess((val) => {
      if (!val || val === "") return [];
      if (typeof val === "string")
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return val;
    }, z.array(z.string()).optional().default([])),
    ALLOWED_ORIGINS: z.preprocess((val) => {
      if (!val || val === "") return [];
      if (typeof val === "string")
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return val;
    }, z.array(z.string()).optional().default([])),
  })
  .superRefine((data, ctx) => {
    const isLiveEnv = data.NODE_ENV === "production" || data.NODE_ENV === "staging";

    if (data.OFFLINE_DEV && isLiveEnv) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `OFFLINE_DEV is not allowed in ${data.NODE_ENV}`,
        path: ["OFFLINE_DEV"],
      });
    }
    if (data.OFFLINE_DEV && !isLocalDatabaseUrl(data.TURSO_DATABASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "OFFLINE_DEV requires a local TURSO_DATABASE_URL",
        path: ["TURSO_DATABASE_URL"],
      });
    }
    if (isLiveEnv && !data.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `TURNSTILE_SECRET_KEY is required in ${data.NODE_ENV}`,
        path: ["TURNSTILE_SECRET_KEY"],
      });
    }
    if (isLiveEnv && !data.HMAC_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `HMAC_SECRET is required in ${data.NODE_ENV}`,
        path: ["HMAC_SECRET"],
      });
    }
    if (data.HMAC_SECRET && !isValidSecret(data.HMAC_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "HMAC_SECRET must be valid base64 and decode to at least 32 bytes",
        path: ["HMAC_SECRET"],
      });
    }
    if (data.PREVIOUS_HMAC_SECRETS) {
      for (let i = 0; i < data.PREVIOUS_HMAC_SECRETS.length; i++) {
        const secret = data.PREVIOUS_HMAC_SECRETS[i];
        if (!isValidSecret(secret)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `PREVIOUS_HMAC_SECRETS[${i}] must be valid base64 and decode to at least 32 bytes`,
            path: ["PREVIOUS_HMAC_SECRETS", i],
          });
        }
      }
    }
  });

export function decodeHmacSecret(secret: string): Uint8Array {
  if (!secret || !/^[A-Za-z0-9+/]*={0,2}$/.test(secret) || secret.length % 4 !== 0) {
    throw new Error("hmacSecret must be valid base64");
  }

  let decoded: string;

  try {
    decoded = atob(secret);
  } catch {
    throw new Error("hmacSecret must be valid base64");
  }

  const keyBytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));

  if (keyBytes.length < 32) {
    throw new Error("hmacSecret must decode to at least 32 bytes");
  }

  return keyBytes;
}

export function isValidSecret(secret: string): boolean {
  try {
    decodeHmacSecret(secret);
    return true;
  } catch {
    return false;
  }
}

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalDatabaseUrl(url: string): boolean {
  if (url === ":memory:" || url.startsWith("file:")) return true;

  try {
    return LOCAL_DATABASE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * TypeScript type representing the validated environment configuration.
 * Inferred from the EnvSchema to ensure type safety.
 */
export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: any) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const issues = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`Invalid environment config - ${issues}`);
  }

  return env;
}
