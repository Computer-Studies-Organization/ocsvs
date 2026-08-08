import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  getCandidateVoteCountRoute,
  getMyVotesRoute,
  getVoteResultsRoute,
  submitVoteRoute,
} from "@/routes/votes/routes";
import { eq } from "drizzle-orm";
import { createDb } from "@/config/db";
import { electionQueries } from "@/database/queries/election.queries";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { voteRepo } from "@/database/repositories/votes.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { positions } from "@/database/schema";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import { ballotCaster } from "@/lib/ballot-caster";

export const submitVote: AppRouteHandler<typeof submitVoteRoute> = async (c) => {
  const { electionId, votes: voteItems } = c.req.valid("json");
  const authUser = c.get("authUser");
  const { db } = createDb(c);

  if (!c.env?.HMAC_SECRET) {
    return c.json(
      { message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR },
      httpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  const previousSecretsRaw = (c.env as any)?.PREVIOUS_HMAC_SECRETS;
  const previousHmacSecrets = previousSecretsRaw
    ? typeof previousSecretsRaw === "string"
      ? previousSecretsRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(previousSecretsRaw)
        ? previousSecretsRaw
        : []
    : [];

  const result = await ballotCaster.cast(db, {
    accountId: authUser.id,
    electionId,
    selections: voteItems,
    hmacSecret: c.env.HMAC_SECRET,
    previousHmacSecrets,
  });

  if (!result.success) {
    return c.json({ message: result.error.message }, result.error.status);
  }

  return c.json(
    {
      message: ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY,
      votes: result.data.votes,
    },
    httpStatusCodes.OK,
  );
};

export const getMyVotes: AppRouteHandler<typeof getMyVotesRoute> = async (c) => {
  const { db } = createDb(c);
  const authUser = c.get("authUser");

  // Get the user associated with this account
  const user = await voterAccountStore.findByAccountId(db, authUser.id);

  if (!user) {
    return c.json({ electionId: null, votes: [] }, httpStatusCodes.OK);
  }

  // Source of truth: the current open election. If none is open, the user has
  // no "current" votes to return.
  const current = await electionRepo.findCurrentlyOpen(db);
  if (!current) {
    return c.json({ electionId: null, votes: [] }, httpStatusCodes.OK);
  }

  const rows = await voteRepo.findByUserAndElection(db, user.id, current.id);
  return c.json(
    {
      electionId: current.id,
      votes: rows.map((r) => ({
        candidateId: r.candidateId,
        positionId: r.positionId,
      })),
    },
    httpStatusCodes.OK,
  );
};

export const getVoteResults: AppRouteHandler<typeof getVoteResultsRoute> = async (c) => {
  const { db } = createDb(c);

  // Get current active election or latest closed election
  const current =
    (await electionRepo.findCurrentlyOpen(db)) ??
    (await electionRepo.findLatestClosedOrExpiredOpen(db));

  if (!current) {
    return c.json(
      {
        results: [],
        meta: {
          totalVotes: 0,
          totalPositions: 0,
        },
      },
      httpStatusCodes.OK,
    );
  }

  // Get results for this election
  const electionResults = await electionQueries.getResults(db, current.id);

  // Map to the legacy VoteResultsResponse format
  const results = electionResults.map((r) => ({
    positionId: r.positionId,
    positionName: r.positionName,
    displayOrder: r.displayOrder,
    candidates: r.candidates.map((cand) => ({
      candidateId: cand.candidateId,
      candidateName: cand.fullName,
      positionId: r.positionId,
      positionName: r.positionName,
      voteCount: cand.voteCount,
    })),
  }));

  // Sort positions by display order
  results.sort((a, b) => a.displayOrder - b.displayOrder);

  const totalVotes = electionResults.reduce((sum, r) => sum + r.totalVotes, 0);

  return c.json(
    {
      results,
      meta: {
        totalVotes,
        totalPositions: results.length,
      },
    },
    httpStatusCodes.OK,
  );
};

export const getCandidateVoteCount: AppRouteHandler<typeof getCandidateVoteCountRoute> = async (
  c,
) => {
  const { id } = c.req.valid("param");
  const { db } = createDb(c);

  // Check if candidate exists (active or inactive — count includes both)
  const candidate = await candidateRepo.getForAdminView(db, id, { includeInactive: true });
  if (!candidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  // Look up the position name for the response
  const position = await db
    .select({ name: positions.name })
    .from(positions)
    .where(eq(positions.id, candidate.positionId))
    .get();

  // Get vote count for this candidate
  const voteCount = await voteRepo.countByCandidateId(db, id);

  return c.json(
    {
      candidateId: id,
      candidateName: candidate.fullName,
      positionId: candidate.positionId,
      positionName: position?.name ?? "",
      voteCount,
    },
    httpStatusCodes.OK,
  );
};
