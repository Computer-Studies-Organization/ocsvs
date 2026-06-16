import {
  createElectionHandler,
  getCurrentElectionHandler,
  getElectionHandler,
  listElectionsHandler,
  transitionElectionHandler,
  updateElectionHandler,
} from '@/handlers/elections/elections.handler'
import { createRouter } from '@/lib/create-app'
import { requireAdmin, requireAuth } from '@/middleware/auth'
import {
  createElectionRoute,
  getCurrentElectionRoute,
  getElectionRoute,
  listElectionsRoute,
  transitionElectionRoute,
  updateElectionRoute,
} from './routes'

const router = createRouter()

router.use('/elections/*', requireAuth)

router.openapi(listElectionsRoute, listElectionsHandler)

router.use('/elections', requireAdmin)
router.openapi(createElectionRoute, createElectionHandler)

router.use('/elections/current', requireAuth)
router.openapi(getCurrentElectionRoute, getCurrentElectionHandler)

router.use('/elections/:id', requireAuth)
router.openapi(getElectionRoute, getElectionHandler)

router.use('/elections/:id', requireAdmin)
router.openapi(updateElectionRoute, updateElectionHandler)

router.use('/elections/:id/transitions', requireAdmin)
router.openapi(transitionElectionRoute, transitionElectionHandler)

export default router
