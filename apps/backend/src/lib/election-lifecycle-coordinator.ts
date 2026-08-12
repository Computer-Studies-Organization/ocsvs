import type { DbClient } from "@/database/repositories/database.type";
import type { TElectionStatus } from "@/database/schema";
import type { ElectionRow } from "@/database/repositories/election.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { electionQueries } from "@/database/queries/election.queries";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import {
  assertTransition,
  getEffectiveElectionStatus,
  TransitionError,
} from "@/lib/election-lifecycle";
import { isUniqueConstraintError } from "@/lib/errors";

export interface CreateElectionInput {
  name: string;
  description?: string | null;
  opensAt?: number | null;
  closesAt?: number | null;
}

export type UpdateElectionInput = Partial<
  Pick<ElectionRow, "name" | "description" | "opensAt" | "closesAt">
>;

export interface TransitionParams {
  to: TElectionStatus;
  actor: { id: string; username: string };
  opensAt?: number;
  closesAt?: number;
}

export interface TransitionResult {
  electionId: string;
  previousStatus: TElectionStatus;
  newStatus: TElectionStatus;
  opensAt: number | null;
  closesAt: number | null;
  messageKey:
    | "ELECTION_OPENED_SUCCESSFULLY"
    | "ELECTION_CLOSED_SUCCESSFULLY"
    | "ELECTION_ARCHIVED_SUCCESSFULLY"
    | "ELECTION_REOPENED_SUCCESSFULLY";
}

export const ElectionLifecycleCoordinator = {
  /**
   * Initializes a Draft Election and writes the audit log atomically.
   */
  async create(
    db: DbClient,
    input: CreateElectionInput,
    actor: { id: string; username: string },
  ): Promise<string> {
    return await db.transaction(async (tx) => {
      const id = await electionRepo.create(tx, input);
      await auditLogRepo.insert(tx, {
        action: "election.create",
        targetType: "election",
        targetId: id,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
      return id;
    });
  },

  /**
   * Updates metadata for a Draft Election and writes the audit log atomically.
   */
  async updateMetadata(
    db: DbClient,
    electionId: string,
    input: UpdateElectionInput,
    actor: { id: string; username: string },
  ): Promise<ElectionRow> {
    return await db.transaction(async (tx) => {
      const existing = await electionRepo.findById(tx, electionId);
      if (!existing) {
        throw new TransitionError("ELECTION_NOT_FOUND", 404);
      }
      if (existing.status !== "draft") {
        throw new TransitionError("ELECTION_NOT_IN_DRAFT", 409);
      }

      await electionRepo.updateMetadata(tx, electionId, input);

      const updated = await electionRepo.findById(tx, electionId);
      if (!updated) {
        throw new Error("Election row missing immediately after update");
      }

      await auditLogRepo.insert(tx, {
        action: "election.update",
        targetType: "election",
        targetId: electionId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });

      return updated;
    });
  },

  /**
   * Transition an election manually (triggered by Admin HTTP requests).
   */
  async transition(
    db: DbClient,
    electionId: string,
    params: TransitionParams,
  ): Promise<TransitionResult> {
    return await db.transaction(async (tx) => {
      // 1. Fetch existing election
      const existing = await electionRepo.findById(tx, electionId);
      if (!existing) {
        throw new TransitionError("ELECTION_NOT_FOUND", 404);
      }

      const fromStatus = existing.status as TElectionStatus;
      const toStatus = params.to;
      const now = Math.floor(Date.now() / 1000);

      // 2. Count positions
      const positionCount = await electionQueries.countPositions(tx, electionId);
      const positionsWithActiveCandidates =
        toStatus === "open"
          ? await electionQueries.countPositionsWithActiveCandidates(tx, electionId)
          : positionCount;

      // 3. Prevent duplicate open elections at application level (backed by DB index)
      if (toStatus === "open") {
        const activeOpen = await electionRepo.findOpen(tx);
        if (activeOpen && activeOpen.id !== electionId) {
          if (getEffectiveElectionStatus(activeOpen, now) !== "closed") {
            throw new TransitionError("ANOTHER_ELECTION_IS_OPEN", 409);
          }

          const closed = await electionRepo.updateStatus(tx, activeOpen.id, {
            existingStatus: "open",
            status: "closed",
            opensAt: activeOpen.opensAt,
            closesAt: activeOpen.closesAt,
          });
          if (!closed) {
            throw new TransitionError("ELECTION_TRANSITION_CONFLICT", 409);
          }

          await auditLogRepo.insert(tx, {
            action: "election.transition",
            targetType: "election",
            targetId: activeOpen.id,
            actorAccountIdSnapshot: params.actor.id,
            actorUsernameSnapshot: params.actor.username,
            description: "open → closed",
          });
        }
      }

      // 4. Resolve timestamps
      const resolvedOpensAt =
        toStatus === "draft"
          ? null
          : params.opensAt !== undefined
            ? params.opensAt
            : (existing.opensAt ?? null);

      const resolvedClosesAt =
        toStatus === "draft"
          ? null
          : params.closesAt !== undefined
            ? params.closesAt
            : toStatus === "closed"
              ? now
              : (existing.closesAt ?? null);

      // 5. Assert transition (using resolved dates). Validation must run AFTER
      // timestamp resolution so it sees the dates that will actually be persisted,
      // not the raw (possibly undefined) values from `params`.
      assertTransition(
        fromStatus,
        toStatus,
        { opensAt: resolvedOpensAt ?? undefined, closesAt: resolvedClosesAt ?? undefined },
        positionCount,
        positionsWithActiveCandidates,
      );

      // 6. Update Status
      try {
        const updated = await electionRepo.updateStatus(tx, electionId, {
          existingStatus: fromStatus,
          status: toStatus,
          opensAt: resolvedOpensAt,
          closesAt: resolvedClosesAt,
        });

        if (!updated) {
          throw new TransitionError("ELECTION_TRANSITION_CONFLICT", 409);
        }
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new TransitionError("ANOTHER_ELECTION_IS_OPEN", 409);
        }
        throw err;
      }

      // 7. Write Audit Log
      const description = `${fromStatus} \u2192 ${toStatus}`;

      await auditLogRepo.insert(tx, {
        action: "election.transition",
        targetType: "election",
        targetId: electionId,
        actorAccountIdSnapshot: params.actor.id,
        actorUsernameSnapshot: params.actor.username,
        description,
      });

      // 8. Resolve success message key
      const messageKey = (
        fromStatus === "draft" && toStatus === "open"
          ? "ELECTION_OPENED_SUCCESSFULLY"
          : toStatus === "closed"
            ? "ELECTION_CLOSED_SUCCESSFULLY"
            : toStatus === "archived"
              ? "ELECTION_ARCHIVED_SUCCESSFULLY"
              : "ELECTION_REOPENED_SUCCESSFULLY"
      ) as TransitionResult["messageKey"];

      return {
        electionId,
        previousStatus: fromStatus,
        newStatus: toStatus,
        opensAt: resolvedOpensAt,
        closesAt: resolvedClosesAt,
        messageKey,
      };
    });
  },
};
