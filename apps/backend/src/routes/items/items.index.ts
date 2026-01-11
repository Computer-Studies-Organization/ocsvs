import * as handlers from '@/handlers/items.handlers'
import { createRouter } from '@/lib/create-app'
import * as routes from '@/routes/items/items.routes'

const router = createRouter()
  .openapi(routes.listOfItems, handlers.list)
  .openapi(routes.createItem, handlers.create)
  .openapi(routes.getItem, handlers.getOne)
  .openapi(routes.patch, handlers.patch)
  .openapi(routes.remove, handlers.remove)

export default router
