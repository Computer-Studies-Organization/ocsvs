import { createRouter } from '@/lib/create-app'
import * as handlers from '@/handlers/auth/auth.handler'
import { loginRoute, logoutRoute, meRoute, registerRoute } from './routes'
import { requireAuth } from '@/middleware/auth'

const router = createRouter()
    // Public routes
    .openapi(registerRoute, handlers.register)
    .openapi(loginRoute, handlers.login)
    .openapi(logoutRoute, handlers.logout)

// Protected routes - apply middleware before OpenAPI route definition
router.use('/me', requireAuth)
router.openapi(meRoute, handlers.me)

export default router
