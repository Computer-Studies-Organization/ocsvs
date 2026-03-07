import * as handlers from '@/handlers/votes/votes.handler'
import { createRouter } from '@/lib/create-app'
import { requireAuth } from '@/middleware/auth'
import {
  getCandidateVoteCountRoute,
  getMyVoteStatusRoute,
  getVoteResultsRoute,
  submitVoteRoute,
  withdrawVoteRoute,
} from './routes'

const router = createRouter()

// Apply authentication middleware to all routes
router.use('*', requireAuth)

// Register routes with handlers
router.openapi(submitVoteRoute, handlers.submitVote)
router.openapi(getMyVoteStatusRoute, handlers.getMyVoteStatus)
router.openapi(getVoteResultsRoute, handlers.getVoteResults)
router.openapi(getCandidateVoteCountRoute, handlers.getCandidateVoteCount)
router.openapi(withdrawVoteRoute, handlers.withdrawVote)

export default router
