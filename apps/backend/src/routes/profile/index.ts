import { createRouter } from '@/lib/create-app'
import { requireAuth } from '@/middleware/auth'
import * as handlers from '@/handlers/profile/profile.handler'
import * as routes from './routes'

const router = createRouter()
router.use('*', requireAuth)
router.openapi(routes.getMyProfileRoute, handlers.getMyProfile)
router.openapi(routes.updateMyProfileRoute, handlers.updateMyProfile)
router.openapi(routes.changePasswordRoute, handlers.changePassword)

export default router
