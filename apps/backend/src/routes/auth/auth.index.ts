import { createRouter } from '@/lib/create-app'
import * as handlers from '@/handlers/auth/auth.handler'
import { loginRoute, registerRoute } from './routes'

const router = createRouter()
    .openapi(registerRoute, handlers.register)
    .openapi(loginRoute, handlers.login)

export default router
