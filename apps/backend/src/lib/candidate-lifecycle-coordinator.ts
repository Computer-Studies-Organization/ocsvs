import type { DbClient } from "@/database/repositories/database.type";
import type { ImageStorage } from "@/lib/b2-client";
import { ImageValidationError } from "@/lib/b2-client";
import { accounts } from "@/database/schema";
import { eq } from "drizzle-orm";
import { candidateRepo, type CandidateRow } from "@/database/repositories/candidates.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export type CandidateLifecycleErrorCode =
  | "CANDIDATE_NOT_FOUND"
  | "ACCOUNT_NOT_FOUND"
  | "CANDIDATE_ALREADY_EXISTS"
  | "POSITION_NOT_FOUND"
  | "ELECTION_NOT_FOUND"
  | "ELECTION_NOT_IN_DRAFT"
  | "UNSUPPORTED_MEDIA_TYPE";

export class CandidateLifecycleError extends Error {
  readonly code: CandidateLifecycleErrorCode;
  readonly status: 400 | 404 | 409 | 415;

  constructor(code: CandidateLifecycleErrorCode, status: 400 | 404 | 409 | 415, message?: string) {
    super(message || ERROR_MESSAGES[code]);
    this.code = code;
    this.status = status;
    this.name = "CandidateLifecycleError";
  }
}

export interface CreateCandidateInput {
  fullName: string;
  accountId: string;
  positionId: string;
  manifesto: string;
}

export interface UpdateCandidateInput {
  fullName?: string;
  manifesto?: string;
}

export interface ActorInfo {
  id: string;
  username: string;
}

export class CandidateLifecycleCoordinator {
  /**
   * Creates a Candidate and logs the action atomically.
   */
  async create(
    db: DbClient,
    input: CreateCandidateInput,
    actor: ActorInfo,
  ): Promise<{
    id: string;
    fullName: string;
    accountId: string;
    positionId: string;
    manifesto: string;
  }> {
    return await db.transaction(async (tx) => {
      // 1. Verify target account exists
      const account = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, input.accountId))
        .get();
      if (!account) {
        throw new CandidateLifecycleError("ACCOUNT_NOT_FOUND", 400);
      }

      // 2. Verify target position exists
      const position = await positionRepo.findById(tx, input.positionId);
      if (!position) {
        throw new CandidateLifecycleError("POSITION_NOT_FOUND", 404);
      }

      // 3. Verify target election exists and is in draft
      const election = await electionRepo.findById(tx, position.electionId);
      if (!election) {
        throw new CandidateLifecycleError("ELECTION_NOT_FOUND", 404);
      }
      if (election.status !== "draft") {
        throw new CandidateLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
      }

      // 4. Ensure no active candidate for the same account+position
      const exists = await candidateRepo.existsActiveForAccountPosition(
        tx,
        input.accountId,
        input.positionId,
      );
      if (exists) {
        throw new CandidateLifecycleError("CANDIDATE_ALREADY_EXISTS", 409);
      }

      // 5. Create Candidate
      const candidateId = await candidateRepo.create(tx, {
        fullName: input.fullName,
        accountId: input.accountId,
        positionId: input.positionId,
        manifesto: input.manifesto,
      });

      // 6. Write Audit Log
      await auditLogRepo.insert(tx, {
        action: "candidate.create",
        targetType: "candidate",
        targetId: candidateId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });

      return {
        id: candidateId,
        fullName: input.fullName,
        accountId: input.accountId,
        positionId: input.positionId,
        manifesto: input.manifesto,
      };
    });
  }

  /**
   * Updates Candidate metadata and logs the action atomically.
   */
  async update(
    db: DbClient,
    id: string,
    input: UpdateCandidateInput,
    actor: ActorInfo,
  ): Promise<CandidateRow> {
    return await db.transaction(async (tx) => {
      // 1. Verify candidate exists (active-only)
      const existing = await candidateRepo.getForAdminView(tx, id);
      if (!existing) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }

      // 2. Perform DB update
      await candidateRepo.update(tx, id, input);

      // 3. Write Audit Log
      await auditLogRepo.insert(tx, {
        action: "candidate.update",
        targetType: "candidate",
        targetId: id,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });

      // 4. Return updated candidate
      const updated = await candidateRepo.getForAdminView(tx, id);
      if (!updated) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }
      return updated;
    });
  }

  /**
   * Soft deletes / deactivates a Candidate and logs the action atomically.
   */
  async deactivate(db: DbClient, id: string, actor: ActorInfo): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Verify candidate exists
      const existing = await candidateRepo.getForAdminView(tx, id);
      if (!existing) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }

      // 2. Perform soft delete
      await candidateRepo.softDelete(tx, id);

      // 3. Write Audit Log
      await auditLogRepo.insert(tx, {
        action: "candidate.deactivate",
        targetType: "candidate",
        targetId: id,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });
  }

  /**
   * Uploads Candidate avatar, updates imageUrl in DB, cleans up old avatar, and logs the action.
   */
  async uploadAvatar(
    db: DbClient,
    id: string,
    file: File,
    storage: ImageStorage,
    actor: ActorInfo,
    logger?: { error(msg: string, ...args: any[]): void; warn(msg: string, ...args: any[]): void },
  ): Promise<CandidateRow> {
    // 1. Fetch existing candidate to check if they exist and get current avatar
    const candidate = await candidateRepo.getForAdminView(db, id);
    if (!candidate) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }

    // 2. Upload to storage
    let url: string;
    try {
      const uploadResult = await storage.upload(id, file);
      url = uploadResult.url;
    } catch (error) {
      if (error instanceof ImageValidationError) {
        throw new CandidateLifecycleError("UNSUPPORTED_MEDIA_TYPE", 415, error.message);
      }
      throw error;
    }

    // 3. Update database image URL and insert audit log in transaction
    let transactionSuccess = false;
    let oldImageUrl: string | null = candidate.imageUrl;
    try {
      await db.transaction(async (tx) => {
        const activeCandidate = await candidateRepo.getForAdminView(tx, id);
        if (!activeCandidate) {
          throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
        }
        oldImageUrl = activeCandidate.imageUrl;

        await candidateRepo.updateImageUrl(tx, id, url);
        await auditLogRepo.insert(tx, {
          action: "candidate.update",
          targetType: "candidate",
          targetId: id,
          actorAccountIdSnapshot: actor.id,
          actorUsernameSnapshot: actor.username,
        });
      });
      transactionSuccess = true;
    } catch (dbError) {
      // Cleanup newly uploaded file to avoid orphaned storage items
      try {
        await storage.delete(url);
      } catch (deleteError) {
        if (logger) {
          logger.error("Failed to clean up newly uploaded B2 image after DB failure", {
            error: deleteError,
          });
        } else {
          console.warn("Failed to clean up newly uploaded B2 image after DB failure:", deleteError);
        }
      }
      throw dbError;
    }

    // 4. Delete old image (best-effort cleanup)
    if (transactionSuccess && oldImageUrl) {
      try {
        await storage.delete(oldImageUrl);
      } catch (deleteError) {
        if (logger) {
          logger.warn("Failed to delete old B2 image during uploadAvatar", { error: deleteError });
        } else {
          console.warn("Failed to delete old B2 image during uploadAvatar:", deleteError);
        }
      }
    }

    // 5. Fetch and return updated candidate
    const updated = await candidateRepo.getForAdminView(db, id);
    if (!updated) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }
    return updated;
  }

  /**
   * Deletes Candidate avatar, clears imageUrl in DB, cleans up avatar in storage, and logs the action.
   */
  async deleteAvatar(
    db: DbClient,
    id: string,
    storage: ImageStorage,
    actor: ActorInfo,
    logger?: { error(msg: string, ...args: any[]): void; warn(msg: string, ...args: any[]): void },
  ): Promise<CandidateRow> {
    // 1. Fetch existing candidate
    const candidate = await candidateRepo.getForAdminView(db, id);
    if (!candidate) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }

    let oldImageUrl: string | null = candidate.imageUrl;
    // 2. Perform DB update inside transaction
    await db.transaction(async (tx) => {
      const activeCandidate = await candidateRepo.getForAdminView(tx, id);
      if (!activeCandidate) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }
      oldImageUrl = activeCandidate.imageUrl;

      await candidateRepo.updateImageUrl(tx, id, null);
      await auditLogRepo.insert(tx, {
        action: "candidate.update",
        targetType: "candidate",
        targetId: id,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });

    // 3. Delete from storage (best-effort cleanup)
    if (oldImageUrl) {
      try {
        await storage.delete(oldImageUrl);
      } catch (deleteError) {
        if (logger) {
          logger.warn("Failed to delete B2 image during deleteAvatar", { error: deleteError });
        } else {
          console.warn("Failed to delete B2 image during deleteAvatar:", deleteError);
        }
      }
    }

    // 4. Fetch and return updated candidate
    const updated = await candidateRepo.getForAdminView(db, id);
    if (!updated) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }
    return updated;
  }
}

export const candidateLifecycleCoordinator = new CandidateLifecycleCoordinator();
