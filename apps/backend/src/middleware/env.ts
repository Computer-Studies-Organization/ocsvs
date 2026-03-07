import { config } from 'dotenv'
import { expand } from 'dotenv-expand'
import { z } from 'zod'

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
 * console.log(env.DATABASE_URL) // string (required, must be valid URL)
 * ```
 */

expand(config())

/**
 * Zod schema defining the structure and validation rules for environment variables.
 *
 * Required variables:
 * - DATABASE_URL: Must be a valid URL format
 *
 * Optional variables with defaults:
 * - NODE_ENV: Defaults to 'development'
 * - PORT: Coerced to number, defaults to 3000
 * - LOG_LEVEL: Must be valid pino log level, defaults to 'info'
 */
const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // DATABASE_URL: z.string().url(),
  // ACCOUNT_ID: z.string().uuid(),
  // DATABASE_NAME: z.string(),
  // DATABASE_ID: z.string().uuid(),
  // DATABASE_AUTH_TOKEN: z.string().optional(),
})
// .superRefine((input, ctx) => {
//   if (input.NODE_ENV === 'production' && !input.DATABASE_AUTH_TOKEN) {
//     ctx.addIssue({
//       code: z.ZodIssueCode.invalid_type,
//       expected: 'string',
//       received: 'undefined',
//       path: ['DATABASE_AUTH_TOKEN'],
//       message: 'DATABASE_AUTH_TOKEN is required in production',
//     })
//   }
// })

/**
 * TypeScript type representing the validated environment configuration.
 * Inferred from the EnvSchema to ensure type safety.
 */
export type Environment = z.infer<typeof EnvSchema>

export function parseEnv(data: any) {
  const { data: env, error } = EnvSchema.safeParse(data)

  if (error) {
    throw new Error(JSON.stringify(error))
  }

  return env
}
