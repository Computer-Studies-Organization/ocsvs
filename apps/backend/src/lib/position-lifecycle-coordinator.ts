import type { DbClient } from "@/database/repositories/database.type";
import type { PositionRow } from "@/database/repositories/position.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { isUniqueConstraintError } from "@/lib/errors";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export type PositionLifecycleErrorCode =
  | "ELECTION_NOT_FOUND"
  | "ELECTION_NOT_IN_DRAFT"
  | "POSITION_NOT_FOUND"
  | "POSITION_ALREADY_EXISTS"
  | "POSITION_HAS_CANDIDATES";

export class PositionLifecycleError extends Error {
  readonly code: PositionLifecycleErrorCode;
  readonly status: 404 | 409;

  constructor(code: PositionLifecycleErrorCode, status: 404 | 409, message?: string) {
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
      if (election.status !== "draft") {
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
      if (election.status !== "draft") {
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
      if (election.status !== "draft") {
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
};
