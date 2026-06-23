import type { AppRouteHandler } from "@/lib/types/app-types";
import type { votingStateRoute } from "@/routes/elections/voting-state.routes";
import { createDb } from "@/config/db";
import { getVotingState } from "@/database/queries/voting-state.queries";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const getVotingStateHandler: AppRouteHandler<typeof votingStateRoute> = async (c) => {
  const account = c.var.authUser;
  if (!account) {
    return c.json({ message: "Unauthorized" }, httpStatusCodes.UNAUTHORIZED);
  }
  const { db } = createDb(c);
  const state = await getVotingState(db, account.id);
  return c.json(state, httpStatusCodes.OK);
};
