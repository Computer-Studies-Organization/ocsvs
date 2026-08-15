import type { DbClient } from "@/database/repositories/database.type";
import type { PartyListRow } from "@/database/repositories/party-list.repository";
import { partyListRepo } from "@/database/repositories/party-list.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { isUniqueConstraintError } from "@/lib/errors";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { isElectionEditable } from "@/lib/election-lifecycle";

export type PartyLifecycleErrorCode =
  | "ELECTION_NOT_FOUND"
  | "ELECTION_NOT_IN_DRAFT"
  | "PARTY_LIST_NOT_FOUND"
  | "PARTY_LIST_ALREADY_EXISTS";

export class PartyLifecycleError extends Error {
  readonly code: PartyLifecycleErrorCode;
  readonly status: 404 | 409;

  constructor(code: PartyLifecycleErrorCode, status: 404 | 409, message?: string) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.status = status;
    this.name = "PartyLifecycleError";
  }
}

export interface ActorInfo {
  id: string;
  username: string;
}

export interface CreatePartyInput {
  electionId: string;
  name: string;
  code: string;
  color?: string | null;
}

export interface UpdatePartyInput {
  electionId: string;
  partyId: string;
  name?: string;
  code?: string;
  color?: string | null;
}

export interface DeletePartyInput {
  electionId: string;
  partyId: string;
}

export const partyLifecycleCoordinator = {
  /**
   * Atomically creates a Party List inside an Election and logs the action.
   */
  async create(db: DbClient, input: CreatePartyInput, actor: ActorInfo): Promise<PartyListRow> {
    return await db.transaction(async (tx) => {
      const election = await electionRepo.findById(tx, input.electionId);
      if (!election) {
        throw new PartyLifecycleError("ELECTION_NOT_FOUND", 404);
      }
      if (!isElectionEditable(election.status)) {
        throw new PartyLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      try {
        const partyId = await partyListRepo.create(tx, {
          electionId: input.electionId,
          name: input.name,
          code: input.code,
          color: input.color,
        });

        const party = await partyListRepo.findById(tx, partyId);
        if (!party) {
          throw new PartyLifecycleError("PARTY_LIST_NOT_FOUND", 404);
        }

        await auditLogRepo.insert(tx, {
          action: "party.create",
          targetType: "party",
          targetId: party.id,
          actorAccountIdSnapshot: actor.id,
          actorUsernameSnapshot: actor.username,
          description: `Created party '${party.name}' (${party.code}) in election '${election.name}'`,
        });

        return party;
      } catch (error) {
        if (error instanceof PartyLifecycleError) {
          throw error;
        }
        if (isUniqueConstraintError(error)) {
          throw new PartyLifecycleError("PARTY_LIST_ALREADY_EXISTS", 409);
        }
        throw error;
      }
    });
  },

  /**
   * Atomically updates a Party List inside an Election and logs the action.
   */
  async update(db: DbClient, input: UpdatePartyInput, actor: ActorInfo): Promise<PartyListRow> {
    return await db.transaction(async (tx) => {
      const existing = await partyListRepo.findById(tx, input.partyId);
      if (!existing || existing.electionId !== input.electionId) {
        throw new PartyLifecycleError("PARTY_LIST_NOT_FOUND", 404);
      }

      const election = await electionRepo.findById(tx, input.electionId);
      if (!election) {
        throw new PartyLifecycleError("ELECTION_NOT_FOUND", 404);
      }
      if (!isElectionEditable(election.status)) {
        throw new PartyLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      try {
        await partyListRepo.update(tx, input.partyId, {
          name: input.name,
          code: input.code,
          color: input.color,
        });

        const updated = await partyListRepo.findById(tx, input.partyId);
        if (!updated) {
          throw new PartyLifecycleError("PARTY_LIST_NOT_FOUND", 404);
        }

        await auditLogRepo.insert(tx, {
          action: "party.update",
          targetType: "party",
          targetId: input.partyId,
          actorAccountIdSnapshot: actor.id,
          actorUsernameSnapshot: actor.username,
          description: `Updated party '${updated.name}' (${updated.code})`,
        });

        return updated;
      } catch (error) {
        if (error instanceof PartyLifecycleError) {
          throw error;
        }
        if (isUniqueConstraintError(error)) {
          throw new PartyLifecycleError("PARTY_LIST_ALREADY_EXISTS", 409);
        }
        throw error;
      }
    });
  },

  /**
   * Atomically deletes a Party List from an Election and logs the action.
   */
  async delete(db: DbClient, input: DeletePartyInput, actor: ActorInfo): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await partyListRepo.findById(tx, input.partyId);
      if (!existing || existing.electionId !== input.electionId) {
        throw new PartyLifecycleError("PARTY_LIST_NOT_FOUND", 404);
      }

      const election = await electionRepo.findById(tx, input.electionId);
      if (!election) {
        throw new PartyLifecycleError("ELECTION_NOT_FOUND", 404);
      }
      if (!isElectionEditable(election.status)) {
        throw new PartyLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      await partyListRepo.delete(tx, input.partyId);

      await auditLogRepo.insert(tx, {
        action: "party.delete",
        targetType: "party",
        targetId: input.partyId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
        description: `Deleted party '${existing.name}' (${existing.code})`,
      });
    });
  },
};
