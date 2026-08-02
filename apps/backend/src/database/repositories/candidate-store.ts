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
    opts: { includeInactive?: boolean; excludeDraft?: boolean } = {},
    urlCtx?: UrlContext,
  ): Promise<CandidateWithResolvedUrl | null> {
    const raw = await candidateRepo.getForAdminView(db, id, opts);
    return formatUrl(raw, urlCtx);
  },

  async listForAdminTable(
    db: DbClient,
    opts: {
      page?: number;
      limit?: number;
      includeInactive?: boolean;
      positionId?: string;
      electionId?: string;
      excludeDraft?: boolean;
    } = {},
    urlCtx?: UrlContext,
  ): Promise<AdminListResult> {
    const result = await candidateRepo.listForAdminTable(db, opts);
    const mappedData = result.data.map((cand) => formatUrl(cand, urlCtx)!);
    return { data: mappedData, meta: result.meta };
  },
};
