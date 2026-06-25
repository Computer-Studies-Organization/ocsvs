import type { AppRouteHandler } from "@/lib/types/app-types";
import type { getElectionResultsRoute } from "@/routes/elections/results.routes";
import { createDb } from "@/config/db";
import { electionQueries } from "@/database/queries/election.queries";
import { electionRepo } from "@/database/repositories/election.repository";
import { userRepo } from "@/database/repositories/users.repository";
import { voteRepo } from "@/database/repositories/votes.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
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

  // If election is open, only admins or users who have voted can access results
  if (election.status === "open") {
    const user = c.var.authUser;
    if (user && user.role !== "admin") {
      const studentUser = await userRepo.findByAccountId(db, user.id);
      if (!studentUser) {
        return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
      }
      const votes = await voteRepo.findByUserAndElection(db, studentUser.id, id);
      if (votes.length === 0) {
        return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
      }
    }
  }

  return c.json(await electionQueries.getResults(db, id), httpStatusCodes.OK);
};
