import type { AppRouteHandler } from "@/lib/types/app-types";
import type { votingStateRoute } from "@/routes/elections/voting-state.routes";
import { createDb } from "@/config/db";
import { getVotingState } from "@/database/queries/voting-state.queries";
import { resolveCandidateImageUrl } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const getVotingStateHandler: AppRouteHandler<typeof votingStateRoute> = async (c) => {
  const account = c.var.authUser;
  if (!account) {
    return c.json({ message: ERROR_MESSAGES.UNAUTHORIZED }, httpStatusCodes.UNAUTHORIZED);
  }

  const { db } = createDb(c);
  const { includeBallot } = c.req.valid("query");
  const state = await getVotingState(db, account.id, { includeBallot });
  const ballot = state.ballot
    ? {
        ...state.ballot,
        candidates: state.ballot.candidates.map((candidate) => ({
          ...candidate,
          imageUrl: c.env
            ? resolveCandidateImageUrl(candidate.imageUrl, candidate.id, c.env, c.req.url)
            : candidate.imageUrl,
        })),
      }
    : null;

  return c.json({ ...state, ballot }, httpStatusCodes.OK);
};
