import type { AppRouteHandler } from "@/lib/types/app-types";
import type { getElectionResultsRoute } from "@/routes/elections/results.routes";
import { createDb } from "@/config/db";
import { electionQueries } from "@/database/queries/election.queries";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const getElectionResultsHandler: AppRouteHandler<typeof getElectionResultsRoute> = async (
  c,
) => {
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  return c.json(await electionQueries.getResults(db, id), httpStatusCodes.OK);
};
