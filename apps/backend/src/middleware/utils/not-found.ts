import type { NotFoundHandler } from 'hono'

import { NOT_FOUND } from '@/openapi/http-status-codes'
import { NOT_FOUND as NOT_FOUND_MESSAGE } from '@/openapi/http-status-phrases'

/**
 * Global 404 Not Found handler for the Hono application.
 * 
 * This middleware handles requests to routes that don't exist in the application.
 * It returns a standardized JSON response with a 404 status code and includes
 * the requested path in the error message for debugging purposes.
 * 
 * Features:
 * - Returns consistent JSON error format
 * - Includes the requested path in the error message
 * - Uses standardized HTTP status codes and phrases
 * 
 * @param c - Hono context object containing request information
 * @returns JSON response with 404 status and error message
 * 
 * @example
 * Response format:
 * ```json
 * {
 *   "message": "Not Found - /api/nonexistent-route"
 * }
 * ```
 * 
 * Usage in app setup:
 * ```typescript
 * app.notFound(notFound)
 * ```
 */
const notFound: NotFoundHandler = (c) => {
  return c.json({
    message: `${NOT_FOUND_MESSAGE} - ${c.req.path}`,
  }, NOT_FOUND)
}

export default notFound
