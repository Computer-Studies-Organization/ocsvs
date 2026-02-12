import { createRouter } from '@/lib/create-app'
import * as handlers from '@/handlers/candidates/candidates.handler'
import { 
    createCandidateRoute, 
    listCandidatesRoute, 
    getCandidateRoute, 
    updateCandidateRoute, 
    deleteCandidateRoute 
} from './routes'
import { requireAuth } from '@/middleware/auth'

const router = createRouter()

// Apply authentication middleware to all routes
router.use("*", requireAuth)

// Register routes with handlers
router.openapi(createCandidateRoute, handlers.createCandidate)
router.openapi(listCandidatesRoute, handlers.listCandidates)
router.openapi(getCandidateRoute, handlers.getCandidate)
router.openapi(updateCandidateRoute, handlers.updateCandidate)
router.openapi(deleteCandidateRoute, handlers.deleteCandidate)

export default router