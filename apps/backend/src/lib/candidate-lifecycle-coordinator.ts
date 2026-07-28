import type { DbClient } from "@/database/repositories/database.type";
import type { ImageStorage } from "@/lib/b2-client";
import { accounts } from "@/database/schema";
import { eq } from "drizzle-orm";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import {
  candidateStore,
  formatUrl,
  type CandidateWithResolvedUrl,
  type UrlContext,
} from "@/database/repositories/candidate-store";
import { ImageValidationError } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export interface CreateCandidateInput {
  fullName: string;
  accountId: string;
  positionId: string;
  partyId?: string | null;
  manifesto: string;
}

export interface UpdateCandidateInput {
  fullName?: string;
  partyId?: string | null;
  manifesto?: string;
}

export interface ActorInfo {
  id: string;
  username: string;
}

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

export type { CandidateWithResolvedUrl, UrlContext };

export class CandidateLifecycleCoordinator {
  /**
   * Creates a Candidate and logs the action atomically.
   */
  async create(
    db: DbClient,
    input: CreateCandidateInput,
    actor: ActorInfo,
    urlCtx?: UrlContext,
  ): Promise<CandidateWithResolvedUrl> {
    const rawCandidate = await db.transaction(async (tx) => {
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

      // 5. Insert the candidate
      const createData: {
        fullName: string;
        accountId: string;
        positionId: string;
        partyId?: string | null;
        manifesto: string;
      } = {
        fullName: input.fullName,
        accountId: input.accountId,
        positionId: input.positionId,
        manifesto: input.manifesto,
      };
      if (input.partyId !== undefined) {
        createData.partyId = input.partyId;
      }
      const newId = await candidateRepo.create(tx, createData);

      // 6. Insert audit log
      await auditLogRepo.insert(tx, {
        action: "candidate.create",
        targetType: "candidate",
        targetId: newId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });

      const fetched = await candidateRepo.getForAdminView(tx, newId, { includeInactive: true });
      if (!fetched) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }
      return fetched;
    });

    return formatUrl(rawCandidate, urlCtx)!;
  }

  /**
   * Updates Candidate metadata and logs the action atomically.
   */
  async update(
    db: DbClient,
    id: string,
    input: UpdateCandidateInput,
    actor: ActorInfo,
    urlCtx?: UrlContext,
  ): Promise<CandidateWithResolvedUrl> {
    const rawCandidate = await db.transaction(async (tx) => {
      const candidate = await candidateRepo.getForAdminView(tx, id);
      if (!candidate || candidate.isActive === 0) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }

      const updateFields: { fullName?: string; partyId?: string | null; manifesto?: string } = {};
      if (input.fullName !== undefined) updateFields.fullName = input.fullName;
      if (input.partyId !== undefined) updateFields.partyId = input.partyId;
      if (input.manifesto !== undefined) updateFields.manifesto = input.manifesto;

      await candidateRepo.update(tx, id, updateFields);

      await auditLogRepo.insert(tx, {
        action: "candidate.update",
        targetType: "candidate",
        targetId: id,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });

      const updated = await candidateRepo.getForAdminView(tx, id, { includeInactive: true });
      if (!updated) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }
      return updated;
    });

    return formatUrl(rawCandidate, urlCtx)!;
  }

  /**
   * Soft deletes / deactivates a Candidate and logs the action atomically.
   */
  async deactivate(db: DbClient, id: string, actor: ActorInfo): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const candidate = await candidateRepo.getForAdminView(tx, id);
      if (!candidate || candidate.isActive === 0) {
        throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
      }

      await candidateRepo.softDelete(tx, id);

      await auditLogRepo.insert(tx, {
        action: "candidate.deactivate",
        targetType: "candidate",
        targetId: id,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });

      return true;
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
    urlCtx?: UrlContext,
    logger?: { error(msg: string, ...args: any[]): void; warn(msg: string, ...args: any[]): void },
  ): Promise<CandidateWithResolvedUrl> {
    const candidate = await candidateStore.findById(db, id, { includeInactive: true });
    if (!candidate || candidate.isActive === 0) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }

    let uploadResult: { url: string; key: string };
    try {
      uploadResult = await storage.upload(id, file);
    } catch (uploadError) {
      if (uploadError instanceof ImageValidationError) {
        throw new CandidateLifecycleError("UNSUPPORTED_MEDIA_TYPE", 415, uploadError.message);
      }
      throw uploadError;
    }

    let oldImageUrl: string | null = candidate.imageUrl;

    try {
      await db.transaction(async (tx) => {
        const activeCandidate = await candidateRepo.getForAdminView(tx, id);
        if (!activeCandidate || activeCandidate.isActive === 0) {
          throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
        }
        oldImageUrl = activeCandidate.imageUrl;

        await candidateRepo.updateImageUrl(tx, id, uploadResult.url);

        await auditLogRepo.insert(tx, {
          action: "candidate.update",
          targetType: "candidate",
          targetId: id,
          actorAccountIdSnapshot: actor.id,
          actorUsernameSnapshot: actor.username,
        });
      });
    } catch (dbError) {
      // Compensating storage cleanup if DB transaction fails
      try {
        await storage.delete(uploadResult.url);
      } catch (deleteError) {
        if (logger) {
          logger.warn("Failed to clean up newly uploaded image after DB rollback", {
            candidateId: id,
            newUrl: uploadResult.url,
            error: deleteError,
          });
        }
      }
      throw dbError;
    }

    // Best-effort cleanup of old image post-commit
    if (oldImageUrl && oldImageUrl !== uploadResult.url) {
      try {
        await storage.delete(oldImageUrl);
      } catch (deleteError) {
        if (logger) {
          logger.warn("Failed to delete old B2 image during uploadAvatar", { error: deleteError });
        }
      }
    }

    const updated = await candidateStore.findById(db, id, { includeInactive: true }, urlCtx);
    if (!updated) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }
    return updated;
  }

  async deleteAvatar(
    db: DbClient,
    id: string,
    storage: ImageStorage,
    actor: ActorInfo,
    urlCtx?: UrlContext,
    logger?: { error(msg: string, ...args: any[]): void; warn(msg: string, ...args: any[]): void },
  ): Promise<CandidateWithResolvedUrl> {
    const candidate = await candidateStore.findById(db, id, { includeInactive: true });
    if (!candidate) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }

    let oldImageUrl: string | null = candidate.imageUrl;

    await db.transaction(async (tx) => {
      const activeCandidate = await candidateRepo.getForAdminView(tx, id);
      if (!activeCandidate || activeCandidate.isActive === 0) {
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

    if (oldImageUrl) {
      try {
        await storage.delete(oldImageUrl);
      } catch (deleteError) {
        if (logger) {
          logger.warn("Failed to delete B2 image during deleteAvatar", { error: deleteError });
        }
      }
    }

    const updated = await candidateStore.findById(db, id, { includeInactive: true }, urlCtx);
    if (!updated) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }
    return updated;
  }

  async downloadAvatar(
    db: DbClient,
    id: string,
    storage: ImageStorage,
  ): Promise<{ data: ArrayBuffer; contentType: string }> {
    const candidate = await candidateRepo.getForAdminView(db, id);
    if (!candidate || !candidate.imageUrl) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }
    return await storage.download(candidate.imageUrl);
  }
}

export const candidateLifecycleCoordinator = new CandidateLifecycleCoordinator();
