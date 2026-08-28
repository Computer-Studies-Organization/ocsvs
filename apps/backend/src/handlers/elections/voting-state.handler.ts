import type { AppRouteHandler } from "@/lib/types/app-types";
import type { votingStateRoute } from "@/routes/elections/voting-state.routes";
import { createDb } from "@/config/db";
import { getVotingState } from "@/database/queries/voting-state.queries";
import { toPublicElection } from "@/lib/election-lifecycle-coordinator";
import { resolveCandidateImageUrl } from "@/lib/b2-client";
import { normalizePreviousHmacSecrets } from "@/lib/ballot-caster";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const getVotingStateHandler: AppRouteHandler<typeof votingStateRoute> = async (c) => {
  const account = c.var.authUser;
  if (!account) {
    return c.json({ message: ERROR_MESSAGES.UNAUTHORIZED }, httpStatusCodes.UNAUTHORIZED);
  }

  const { db } = createDb(c);
  const { includeBallot } = c.req.valid("query");
  const state = await getVotingState(db, account.id, {
    includeBallot,
    hmacSecret: c.env?.HMAC_SECRET,
    previousHmacSecrets: normalizePreviousHmacSecrets(c.env?.PREVIOUS_HMAC_SECRETS),
  });
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
  const lastClosed = state.lastClosed
    ? {
        ...state.lastClosed,
        results: state.lastClosed.results.map((position) => ({
          ...position,
          candidates: position.candidates.map((candidate) => ({
            ...candidate,
            imageUrl: c.env
              ? resolveCandidateImageUrl(
                  candidate.imageUrl ?? null,
                  candidate.candidateId,
                  c.env,
                  c.req.url,
                )
              : candidate.imageUrl,
          })),
        })),
      }
    : null;

  return c.json(
    { ...state, open: state.open ? toPublicElection(state.open) : null, lastClosed, ballot },
    httpStatusCodes.OK,
  );
};
