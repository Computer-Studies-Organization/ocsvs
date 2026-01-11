/**
 * Simple custom logger function with timestamp formatting.
 * 
 * This is a lightweight logging utility that adds ISO timestamp prefixes
 * to console output. It's designed as an alternative to more complex
 * logging solutions when simple timestamped console output is sufficient.
 * 
 * Features:
 * - Automatic ISO timestamp formatting
 * - Support for multiple message arguments
 * - Uses console.warn for output (to distinguish from regular console.log)
 * - Minimal overhead and dependencies
 * 
 * @param message - The primary log message
 * @param rest - Additional string arguments to log
 * 
 * @example
 * ```typescript
 * import { customLogger } from '@/middleware/custom-logger'
 * 
 * // Usage in Hono logger middleware
 * app.use(logger(customLogger))
 * 
 * // Direct usage
 * customLogger('Server started', 'on port 3000')
 * // Output: [2024-01-15T10:30:45.123Z] - Server started on port 3000
 * ```
 * 
 * Note: This logger outputs to console.warn to differentiate from
 * application console.log statements and to ensure visibility in
 * most logging configurations.
 */
export function customLogger(message: string, ...rest: string[]) {
  const timestamp = new Date().toISOString()
  console.warn(`[${timestamp}] - ${message}`, ...rest)
}
