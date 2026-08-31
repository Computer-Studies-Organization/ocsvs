import type { DbClient } from "@/database/repositories/database.type";
import type { PositionRow } from "@/database/repositories/position.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { isUniqueConstraintError } from "@/lib/errors";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { isElectionEditable } from "@/lib/election-lifecycle";

export type PositionLifecycleErrorCode =
  | "ELECTION_NOT_FOUND"
  | "ELECTION_NOT_IN_DRAFT"
  | "POSITION_NOT_FOUND"
  | "POSITION_ALREADY_EXISTS"
  | "POSITION_HAS_CANDIDATES"
  | "INVALID_POSITION_REORDER";

export class PositionLifecycleError extends Error {
  readonly code: PositionLifecycleErrorCode;
  readonly status: 400 | 404 | 409 | 422;

  constructor(code: PositionLifecycleErrorCode, status: 400 | 404 | 409 | 422, message?: string) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.status = status;
    this.name = "PositionLifecycleError";
  }
}

export interface ActorInfo {
  id: string;
  username: string;
}

export const positionLifecycleCoordinator = {
  /**
   * Atomically creates a Position inside an Election, validating state and logging.
   */
  async create(
    db: DbClient,
    input: { electionId: string; name: string; displayOrder?: number },
    actor: ActorInfo,
  ): Promise<PositionRow> {
    return await db.transaction(async (tx) => {
      // 1. Verify election exists
      const election = await electionRepo.findById(tx, input.electionId);
      if (!election) {
        throw new PositionLifecycleError("ELECTION_NOT_FOUND", 404);
      }

      // 2. Verify election status is draft
      if (!isElectionEditable(election.status)) {
        throw new PositionLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      try {
        // 3. Create position
        const newId = await positionRepo.create(tx, {
          electionId: input.electionId,
          name: input.name,
          displayOrder: input.displayOrder,
        });

        // 4. Write audit log
        await auditLogRepo.insert(tx, {
          action: "position.create",
          targetType: "position",
          targetId: newId,
          actorAccountIdSnapshot: actor.id,
          actorUsernameSnapshot: actor.username,
        });

        const created = await positionRepo.findById(tx, newId);
        if (!created) {
          throw new Error("Position row missing immediately after create");
        }
        return created;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new PositionLifecycleError("POSITION_ALREADY_EXISTS", 409);
        }
        throw error;
      }
    });
  },

  /**
   * Atomically updates a Position inside an Election.
   */
  async update(
    db: DbClient,
    input: { electionId: string; positionId: string; name?: string; displayOrder?: number },
    actor: ActorInfo,
  ): Promise<PositionRow> {
    return await db.transaction(async (tx) => {
      // 1. Verify position exists and belongs to the specified election
      const position = await positionRepo.findById(tx, input.positionId);
      if (!position || position.electionId !== input.electionId) {
        throw new PositionLifecycleError("POSITION_NOT_FOUND", 404);
      }

      // 2. Verify election status is draft
      const election = await electionRepo.findById(tx, input.electionId);
      if (!election) {
        throw new PositionLifecycleError("ELECTION_NOT_FOUND", 404);
      }
      if (!isElectionEditable(election.status)) {
        throw new PositionLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      try {
        // 3. Perform update
        await positionRepo.update(tx, input.positionId, {
          name: input.name,
          displayOrder: input.displayOrder,
        });

        // 4. Write audit log
        await auditLogRepo.insert(tx, {
          action: "position.update",
          targetType: "position",
          targetId: input.positionId,
          actorAccountIdSnapshot: actor.id,
          actorUsernameSnapshot: actor.username,
        });

        const updated = await positionRepo.findById(tx, input.positionId);
        if (!updated) {
          throw new Error("Position row missing immediately after update");
        }
        return updated;
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new PositionLifecycleError("POSITION_ALREADY_EXISTS", 409);
        }
        throw error;
      }
    });
  },

  /**
   * Atomically deletes a Position from an Election.
   */
  async delete(
    db: DbClient,
    input: { electionId: string; positionId: string },
    actor: ActorInfo,
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Verify position exists and belongs to the specified election
      const position = await positionRepo.findById(tx, input.positionId);
      if (!position || position.electionId !== input.electionId) {
        throw new PositionLifecycleError("POSITION_NOT_FOUND", 404);
      }

      // 2. Verify election status is draft
      const election = await electionRepo.findById(tx, input.electionId);
      if (!election) {
        throw new PositionLifecycleError("ELECTION_NOT_FOUND", 404);
      }
      if (!isElectionEditable(election.status)) {
        throw new PositionLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      // 3. Verify no candidates are assigned to this position
      const candidateCount = await candidateRepo.countByPositionId(tx, input.positionId, {
        includeInactive: true,
      });
      if (candidateCount > 0) {
        throw new PositionLifecycleError("POSITION_HAS_CANDIDATES", 409);
      }

      // 4. Perform delete
      await positionRepo.delete(tx, input.positionId);

      // 5. Write audit log
      await auditLogRepo.insert(tx, {
        action: "position.delete",
        targetType: "position",
        targetId: input.positionId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });
  },

  /**
   * Atomically reorders all positions in a draft election.
   */
  async reorder(
    db: DbClient,
    input: { electionId: string; positionIds: string[] },
    actor: ActorInfo,
  ): Promise<PositionRow[]> {
    return await db.transaction(async (tx) => {
      // 1. Verify election exists
      const election = await electionRepo.findById(tx, input.electionId);
      if (!election) {
        throw new PositionLifecycleError("ELECTION_NOT_FOUND", 404);
      }

      // 2. Verify election status is draft
      if (!isElectionEditable(election.status)) {
        throw new PositionLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      // 3. Fetch existing positions
      const existing = await positionRepo.listByElection(tx, input.electionId);
      const existingIds = new Set(existing.map((p) => p.id));

      // 4. Validate exact permutation
      if (
        input.positionIds.length !== existing.length ||
        new Set(input.positionIds).size !== input.positionIds.length ||
        !input.positionIds.every((id) => existingIds.has(id))
      ) {
        throw new PositionLifecycleError("INVALID_POSITION_REORDER", 422);
      }

      // 5. Apply reorder if positions exist
      if (input.positionIds.length > 0) {
        await positionRepo.reorder(tx, input.positionIds);
      }

      // 6. Write audit log
      await auditLogRepo.insert(tx, {
        action: "position.reorder",
        targetType: "election",
        targetId: input.electionId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });

      // 7. Return refreshed positions sorted by displayOrder
      return await positionRepo.listByElection(tx, input.electionId);
    });
  },
};
