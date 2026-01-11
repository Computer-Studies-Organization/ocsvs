import type { ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

/**
 * Global error handler for the Hono application.
 *
 * This middleware catches and handles all unhandled errors in the application.
 * It provides different handling for HTTP exceptions versus general errors,
 * and includes environment-aware error details (stack traces only in development).
 *
 * Error handling logic:
 * - HTTPException: Uses the exception's built-in response generation
 * - Other errors: Returns a generic 500 Internal Server Error
 * - Stack traces: Only included in non-production environments
 *
 * @param err - The error object that was thrown
 * @param c - Hono context object containing request/response information
 * @returns Appropriate error response based on error type and environment
 *
 * @example
 * HTTPException response (handled automatically):
 * ```json
 * {
 *   "message": "Bad Request",
 *   "status": 400
 * }
 * ```
 *
 * Generic error response (development):
 * ```json
 * {
 *   "message": "Internal Server Error",
 *   "error": "Database connection failed",
 *   "stack": "Error: Database connection failed\n    at ..."
 * }
 * ```
 *
 * Generic error response (production):
 * ```json
 * {
 *   "message": "Internal Server Error",
 *   "error": "Database connection failed"
 * }
 * ```
 *
 * Usage in app setup:
 * ```typescript
 * app.onError(onError)
 * ```
 */
const onError: ErrorHandler = (err, c) => {
  // Check if the error is an instance of HTTPException
  if (err instanceof HTTPException) {
    // Use the built-in getResponse() method to generate a Response object
    // This automatically handles status codes and headers.
    return err.getResponse()
  }

  // For all other errors, return a generic 500 response
  // You can customize this as needed
  // eslint-disable-next-line node/prefer-global/process
  const env = c.env?.NODE_ENV || process.env?.NODE_ENV
  return c.json(
    {
      message: 'Internal Server Error',
      error: err.message,
      stack: env === 'production' ? undefined : err.stack,
    },
    500,
  )
}

export default onError
