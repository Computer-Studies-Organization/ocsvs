import * as handlers from '@/handlers/auth/auth.handler'
import { createRouter } from '@/lib/create-app'
import { requireAuth } from '@/middleware/auth'
import { loginRoute, logoutRoute, meRoute, registerRoute } from './routes'

const router = createRouter()
// Public routes
  .openapi(registerRoute, handlers.register)
  .openapi(loginRoute, handlers.login)
  .openapi(logoutRoute, handlers.logout)

// Protected routes - apply middleware before OpenAPI route definition
router.use('/me', requireAuth)
router.openapi(meRoute, handlers.me)

export default router
