import * as handlers from '@/handlers/users/users.handler'
import { createRouter } from '@/lib/create-app'
import { requireAdmin, requireAuth } from '@/middleware/auth'
import { listUsersRoute } from './routes'

const router = createRouter()
router.use('*', requireAuth)
router.use('*', requireAdmin)
router.openapi(listUsersRoute, handlers.listUsers)

export default router
