import type { AppRouteHandler } from "@/lib/types/app-types";
import type { getElectionResultsRoute } from "@/routes/elections/results.routes";
import { createDb } from "@/config/db";
import { electionQueries } from "@/database/queries/election.queries";
import { electionRepo } from "@/database/repositories/election.repository";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { getEffectiveElectionStatus } from "@/lib/election-lifecycle";
import { hasVoterParticipated, normalizePreviousHmacSecrets } from "@/lib/ballot-caster";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const getElectionResultsHandler: AppRouteHandler<typeof getElectionResultsRoute> = async (
  c,
) => {
  const { db } = createDb(c);
  const { id } = c.req.valid("param");

  const election = await electionRepo.findById(db, id);
  if (!election) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  const user = c.var.authUser;
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const effectiveStatus = getEffectiveElectionStatus(election);

  // Draft elections are not visible to non-admins (404 matches the UI behaviour
  // of hiding drafts from the voter listing, and avoids leaking candidate names).
  if (effectiveStatus === "draft" && !isAdmin) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  // If election is open, only admins or users who have voted can access results
  if (effectiveStatus === "open" && !isAdmin) {
    const studentUser = await voterAccountStore.findByAccountId(db, user!.id);
    if (!studentUser) {
      return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
    }
    const hasVoted = await hasVoterParticipated(
      db,
      id,
      studentUser.studentId,
      c.env?.HMAC_SECRET,
      normalizePreviousHmacSecrets(c.env?.PREVIOUS_HMAC_SECRETS),
      studentUser.id,
    );
    if (!hasVoted) {
      return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
    }
  }

  return c.json(await electionQueries.getResults(db, id), httpStatusCodes.OK);
};
