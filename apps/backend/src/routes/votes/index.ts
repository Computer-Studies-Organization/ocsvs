import * as handlers from "@/handlers/votes/votes.handler";
import { createRouter } from "@/lib/create-app";
import { requireAdmin, requireAuth } from "@/middleware/auth";
import {
  getCandidateVoteCountRoute,
  getMyVotesRoute,
  getVoteResultsRoute,
  submitVoteRoute,
} from "./routes";

const router = createRouter();

// Apply authentication middleware to votes routes
router.use("/votes/*", requireAuth);

// Admin-only routes
router.use("/votes/results", requireAdmin);
router.use("/votes/candidates/:id/count", requireAdmin);

// Register routes with handlers
router.openapi(submitVoteRoute, handlers.submitVote);
router.openapi(getMyVotesRoute, handlers.getMyVotes);
router.openapi(getVoteResultsRoute, handlers.getVoteResults);
router.openapi(getCandidateVoteCountRoute, handlers.getCandidateVoteCount);

export default router;
