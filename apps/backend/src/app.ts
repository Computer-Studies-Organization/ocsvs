import type { AppOpenAPI } from './lib/types/app-types'
import createApp from '@/lib/create-app'
import configureOpenAPI from '@/lib/openapi-configuration'
import index from '@/routes/index.route'
import auth from '@/routes/auth/auth.index'
import users from '@/routes/users'

const app = createApp()

const routes = [index, auth, users]

configureOpenAPI(app as AppOpenAPI)

routes.forEach((route) => {
  app.route('/', route)
})

app.get('/', (c) => {
  c.var.logger.info('Root endpoint accessed')
  return c.text('Hello Hono!')
})

export default app
