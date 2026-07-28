import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createPartyListRoute,
  deletePartyListRoute,
  listPartyListsRoute,
  updatePartyListRoute,
} from "@/routes/parties/parties.routes";
import { createDb } from "@/config/db";
import { electionRepo } from "@/database/repositories/election.repository";
import { partyListRepo } from "@/database/repositories/party-list.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { partyLifecycleCoordinator, PartyLifecycleError } from "@/lib/party-lifecycle-coordinator";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const listPartyListsHandler: AppRouteHandler<typeof listPartyListsRoute> = async (c) => {
  const { db } = createDb(c);
  const { id: electionId } = c.req.valid("param");
  const election = await electionRepo.findById(db, electionId);
  if (!election) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  const items = await partyListRepo.listByElection(db, electionId);
  return c.json(items, httpStatusCodes.OK);
};

export const createPartyListHandler: AppRouteHandler<typeof createPartyListRoute> = async (c) => {
  const actor = c.var.authUser;
  const { db } = createDb(c);
  const { id: electionId } = c.req.valid("param");
  const body = c.req.valid("json");

  try {
    const party = await partyLifecycleCoordinator.create(
      db,
      {
        electionId,
        name: body.name,
        code: body.code,
        color: body.color,
      },
      actor,
    );
    return c.json(party, httpStatusCodes.CREATED);
  } catch (error) {
    if (error instanceof PartyLifecycleError) {
      if (error.status === 404) {
        return c.json({ message: error.message }, httpStatusCodes.NOT_FOUND);
      }
      return c.json({ message: error.message }, httpStatusCodes.CONFLICT);
    }
    throw error;
  }
};

export const updatePartyListHandler: AppRouteHandler<typeof updatePartyListRoute> = async (c) => {
  const actor = c.var.authUser;
  const { db } = createDb(c);
  const { id: electionId, partyId } = c.req.valid("param");
  const body = c.req.valid("json");

  try {
    const updated = await partyLifecycleCoordinator.update(
      db,
      {
        electionId,
        partyId,
        name: body.name,
        code: body.code,
        color: body.color,
      },
      actor,
    );
    return c.json(updated, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof PartyLifecycleError) {
      if (error.status === 404) {
        return c.json({ message: error.message }, httpStatusCodes.NOT_FOUND);
      }
      return c.json({ message: error.message }, httpStatusCodes.CONFLICT);
    }
    throw error;
  }
};

export const deletePartyListHandler: AppRouteHandler<typeof deletePartyListRoute> = async (c) => {
  const actor = c.var.authUser;
  const { db } = createDb(c);
  const { id: electionId, partyId } = c.req.valid("param");

  try {
    await partyLifecycleCoordinator.delete(
      db,
      {
        electionId,
        partyId,
      },
      actor,
    );
    return c.json({ message: ERROR_MESSAGES.PARTY_LIST_DELETED_SUCCESSFULLY }, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof PartyLifecycleError) {
      return c.json({ message: error.message }, httpStatusCodes.NOT_FOUND);
    }
    throw error;
  }
};
