import type { DbClient } from "./database.type";
import { candidates } from "@/database/schema";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { resolveCandidateImageUrl } from "@/lib/b2-client";

export type CandidateRow = typeof candidates.$inferSelect;

export interface CandidateWithResolvedUrl extends CandidateRow {
  imageUrl: string | null;
}

export interface AdminListResult {
  data: CandidateWithResolvedUrl[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface VoteCountResult {
  candidateId: string;
  candidateName: string;
  positionId: string;
  positionName: string;
  voteCount: number;
}

export interface UrlContext {
  env?: any;
  requestUrl?: string;
}

export function formatUrl(
  cand: CandidateRow | null,
  urlCtx?: UrlContext,
): CandidateWithResolvedUrl | null {
  if (!cand) return null;
  if (!urlCtx?.env || !urlCtx?.requestUrl) {
    return { ...cand, imageUrl: cand.imageUrl };
  }
  return {
    ...cand,
    imageUrl: resolveCandidateImageUrl(cand.imageUrl, cand.id, urlCtx.env, urlCtx.requestUrl),
  };
}

export const candidateStore = {
  // --- Queries ---

  async findById(
    db: DbClient,
    id: string,
    opts: { includeInactive?: boolean } = {},
    urlCtx?: UrlContext,
  ): Promise<CandidateWithResolvedUrl | null> {
    const raw = await candidateRepo.getForAdminView(db, id, opts);
    return formatUrl(raw, urlCtx);
  },

  async getForAdminView(
    db: DbClient,
    id: string,
    opts: { includeInactive?: boolean } = {},
    urlCtx?: UrlContext,
  ): Promise<CandidateWithResolvedUrl | null> {
    return this.findById(db, id, opts, urlCtx);
  },

  async listForAdminTable(
    db: DbClient,
    opts: {
      page?: number;
      limit?: number;
      includeInactive?: boolean;
      positionId?: string;
      electionId?: string;
    } = {},
    urlCtx?: UrlContext,
  ): Promise<AdminListResult> {
    const result = await candidateRepo.listForAdminTable(db, opts);
    const mappedData = result.data.map((cand) => formatUrl(cand, urlCtx)!);
    return { data: mappedData, meta: result.meta };
  },

  async listForBallot(
    db: DbClient,
  ): Promise<{ id: string; fullName: string; positionId: string; partyId: string | null }[]> {
    return await candidateRepo.listForBallot(db);
  },

  async getForValidation(
    db: DbClient,
    id: string,
  ): Promise<{ id: string; positionId: string } | null> {
    return await candidateRepo.getForValidation(db, id);
  },

  async countActive(db: DbClient): Promise<number> {
    return await candidateRepo.countActive(db);
  },

  async countByPositionId(
    db: DbClient,
    positionId: string,
    opts: { includeInactive?: boolean } = {},
  ): Promise<number> {
    return await candidateRepo.countByPositionId(db, positionId, opts);
  },

  async findActiveByIds(
    db: DbClient,
    ids: string[],
  ): Promise<Map<string, { id: string; positionId: string }>> {
    return await candidateRepo.findActiveByIds(db, ids);
  },

  async existsActiveForAccountPosition(
    db: DbClient,
    accountId: string,
    positionId: string,
  ): Promise<boolean> {
    return await candidateRepo.existsActiveForAccountPosition(db, accountId, positionId);
  },

  async isCandidate(db: DbClient, accountId: string): Promise<boolean> {
    return await candidateRepo.isCandidate(db, accountId);
  },

  async listWithVoteCount(db: DbClient): Promise<VoteCountResult[]> {
    return await candidateRepo.listWithVoteCount(db);
  },

  async updateImageUrl(db: DbClient, id: string, imageUrl: string | null): Promise<boolean> {
    return await candidateRepo.updateImageUrl(db, id, imageUrl);
  },

  async softDelete(db: DbClient, id: string): Promise<boolean> {
    return await candidateRepo.softDelete(db, id);
  },
};
