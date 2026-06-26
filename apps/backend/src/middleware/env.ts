import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

/**
 * Environment configuration module with type-safe validation.
 *
 * This module loads and validates environment variables using Zod schemas,
 * ensuring that the application has all required configuration values
 * with proper types before startup. It uses dotenv for loading .env files
 * and dotenv-expand for variable expansion.
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

expand(config());

/**
 * Zod schema defining the structure and validation rules for environment variables.
 *
 * Required variables:
 * - TURSO_DATABASE_URL: Must be a non-empty string (supports libSQL URLs, local file paths, or :memory:)
 *
 * Optional variables:
 * - TURSO_AUTH_TOKEN: Optional authorization token for Turso
 * - B2_APPLICATION_KEY_ID: Optional Backblaze B2 application key ID (required at runtime for image endpoints)
 * - B2_APPLICATION_KEY: Optional Backblaze B2 application key (required at runtime for image endpoints)
 *
 * Optional variables with defaults:
 * - NODE_ENV: Defaults to 'development'
 * - PORT: Coerced to number, defaults to 3000
 * - LOG_LEVEL: Must be valid pino log level, defaults to 'info'
 */
const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  B2_APPLICATION_KEY_ID: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().optional(),
  ),
  B2_APPLICATION_KEY: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  B2_PUBLIC_ACCESS: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().default(false),
  ),
});

/**
 * TypeScript type representing the validated environment configuration.
 * Inferred from the EnvSchema to ensure type safety.
 */
export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(data: any) {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    throw new Error(JSON.stringify(error));
  }

  return env;
}
