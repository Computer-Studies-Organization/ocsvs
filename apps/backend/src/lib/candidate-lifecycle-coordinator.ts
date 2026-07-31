import type { DbClient } from "@/database/repositories/database.type";
import type { ImageStorage } from "@/lib/b2-client";
import { accounts } from "@/database/schema";
import { eq } from "drizzle-orm";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { partyListRepo } from "@/database/repositories/party-list.repository";
import {
  candidateStore,
  formatUrl,
  type CandidateWithResolvedUrl,
  type UrlContext,
} from "@/database/repositories/candidate-store";
import { ImageValidationError } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { isUniqueConstraintError } from "@/lib/errors";

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
  | "PARTY_ALREADY_HAS_CANDIDATE_FOR_POSITION"
  | "POSITION_NOT_FOUND"
  | "ELECTION_NOT_FOUND"
  | "PARTY_LIST_NOT_FOUND"
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
  private async getDraftPosition(db: DbClient, positionId: string) {
    const position = await positionRepo.findById(db, positionId);
    if (!position) {
      throw new CandidateLifecycleError("POSITION_NOT_FOUND", 404);
    }

    const election = await electionRepo.findById(db, position.electionId);
    if (!election) {
      throw new CandidateLifecycleError("ELECTION_NOT_FOUND", 404);
    }
    if (election.status !== "draft") {
      throw new CandidateLifecycleError("ELECTION_NOT_IN_DRAFT", 409);
    }

    return position;
  }

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

      // 2. Verify target position exists and belongs to a draft election.
      const position = await this.getDraftPosition(tx, input.positionId);

      // 4. Verify the party belongs to the position's election
      if (input.partyId !== null && input.partyId !== undefined) {
        const party = await partyListRepo.findById(tx, input.partyId);
        if (!party || party.electionId !== position.electionId) {
          throw new CandidateLifecycleError("PARTY_LIST_NOT_FOUND", 404);
        }
      }

      // 5. Ensure no active candidate for the same account+position
      const exists = await candidateRepo.existsActiveForAccountPosition(
        tx,
        input.accountId,
        input.positionId,
      );
      if (exists) {
        throw new CandidateLifecycleError("CANDIDATE_ALREADY_EXISTS", 409);
      }

      if (input.partyId !== null && input.partyId !== undefined) {
        const partyAlreadyRepresented = await candidateRepo.existsActiveForPartyPosition(
          tx,
          input.partyId,
          input.positionId,
        );
        if (partyAlreadyRepresented) {
          throw new CandidateLifecycleError("PARTY_ALREADY_HAS_CANDIDATE_FOR_POSITION", 409);
        }
      }

      // 6. Insert the candidate
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
      let newId: string;
      try {
        newId = await candidateRepo.create(tx, createData);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          if (input.partyId !== null && input.partyId !== undefined) {
            throw new CandidateLifecycleError("PARTY_ALREADY_HAS_CANDIDATE_FOR_POSITION", 409);
          }
          throw new CandidateLifecycleError("CANDIDATE_ALREADY_EXISTS", 409);
        }
        throw error;
      }

      // 7. Insert audit log
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

      const position = await this.getDraftPosition(tx, candidate.positionId);

      if (input.partyId !== undefined) {
        if (input.partyId !== null) {
          const party = await partyListRepo.findById(tx, input.partyId);
          if (!party || party.electionId !== position.electionId) {
            throw new CandidateLifecycleError("PARTY_LIST_NOT_FOUND", 404);
          }

          const partyAlreadyRepresented = await candidateRepo.existsActiveForPartyPosition(
            tx,
            input.partyId,
            candidate.positionId,
            id,
          );
          if (partyAlreadyRepresented) {
            throw new CandidateLifecycleError("PARTY_ALREADY_HAS_CANDIDATE_FOR_POSITION", 409);
          }
        }
      }

      const updateFields: { fullName?: string; partyId?: string | null; manifesto?: string } = {};
      if (input.fullName !== undefined) updateFields.fullName = input.fullName;
      if (input.partyId !== undefined) updateFields.partyId = input.partyId;
      if (input.manifesto !== undefined) updateFields.manifesto = input.manifesto;

      try {
        await candidateRepo.update(tx, id, updateFields);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new CandidateLifecycleError("PARTY_ALREADY_HAS_CANDIDATE_FOR_POSITION", 409);
        }
        throw error;
      }

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

      await this.getDraftPosition(tx, candidate.positionId);

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
    await this.getDraftPosition(db, candidate.positionId);

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
        await this.getDraftPosition(tx, activeCandidate.positionId);
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
      await this.getDraftPosition(tx, activeCandidate.positionId);
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
    opts: { includeInactive?: boolean } = {},
  ): Promise<{ data: ArrayBuffer; contentType: string }> {
    const candidate = await candidateRepo.getForAdminView(db, id, opts);
    if (!candidate || !candidate.imageUrl) {
      throw new CandidateLifecycleError("CANDIDATE_NOT_FOUND", 404);
    }
    return await storage.download(candidate.imageUrl);
  }
}

export const candidateLifecycleCoordinator = new CandidateLifecycleCoordinator();
