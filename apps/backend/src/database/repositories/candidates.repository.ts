import type { DbClient } from "./database.type";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { candidates, positions, votes } from "@/database/schema";

export type CandidateRow = typeof candidates.$inferSelect;

export interface AdminListResult {
  data: CandidateRow[];
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

export const candidateRepo = {
  // Ballot: minimal fields, active-only
  async listForBallot(
    db: DbClient,
  ): Promise<{ id: string; fullName: string; positionId: string; partyId: string | null }[]> {
    return await db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        positionId: candidates.positionId,
        partyId: candidates.partyId,
      })
      .from(candidates)
      .where(eq(candidates.isActive, 1))
      .all();
  },

  // Admin table: full candidate records, paginated, opt inactive include
  async listForAdminTable(
    db: DbClient,
    opts: { page?: number; limit?: number; includeInactive?: boolean; positionId?: string } = {},
  ): Promise<AdminListResult> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 10;
    const includeInactive = opts.includeInactive ?? false;
    const positionId = opts.positionId;
    const offset = (page - 1) * limit;

    const baseWhere = includeInactive ? undefined : eq(candidates.isActive, 1);
    const positionWhere = positionId ? eq(candidates.positionId, positionId) : undefined;
    const whereClause = positionWhere
      ? baseWhere
        ? and(baseWhere, positionWhere)
        : positionWhere
      : baseWhere;

    const dataQuery = db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        accountId: candidates.accountId,
        positionId: candidates.positionId,
        partyId: candidates.partyId,
        manifesto: candidates.manifesto,
        isActive: candidates.isActive,
        imageUrl: candidates.imageUrl,
        createdAt: candidates.createdAt,
        updatedAt: candidates.updatedAt,
      })
      .from(candidates)
      .orderBy(desc(candidates.createdAt), desc(candidates.id))
      .limit(limit)
      .offset(offset);

    const countQuery = db.select({ count: count() }).from(candidates);

    const [data, totalRaw] = await Promise.all([
      whereClause ? dataQuery.where(whereClause).all() : dataQuery.all(),
      whereClause ? countQuery.where(whereClause).get() : countQuery.get(),
    ]);

    const total = (totalRaw as { count: number } | null)?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return { data, meta: { total, page, limit, totalPages } };
  },

  // Single-candidate read for vote validation (active-only, minimal fields)
  async getForValidation(
    db: DbClient,
    id: string,
  ): Promise<{ id: string; positionId: string } | null> {
    return (
      (await db
        .select({ id: candidates.id, positionId: candidates.positionId })
        .from(candidates)
        .where(and(eq(candidates.id, id), eq(candidates.isActive, 1)))
        .get()) ?? null
    );
  },

  // Single-candidate full view for admin (optionally include inactive)
  async getForAdminView(
    db: DbClient,
    id: string,
    opts: { includeInactive?: boolean } = {},
  ): Promise<CandidateRow | null> {
    const includeInactive = opts.includeInactive ?? false;
    const whereClause = includeInactive
      ? eq(candidates.id, id)
      : and(eq(candidates.id, id), eq(candidates.isActive, 1));

    return (
      (await db
        .select({
          id: candidates.id,
          fullName: candidates.fullName,
          accountId: candidates.accountId,
          positionId: candidates.positionId,
          partyId: candidates.partyId,
          manifesto: candidates.manifesto,
          isActive: candidates.isActive,
          imageUrl: candidates.imageUrl,
          createdAt: candidates.createdAt,
          updatedAt: candidates.updatedAt,
        })
        .from(candidates)
        .where(whereClause)
        .get()) ?? null
    );
  },

  // Count of active candidates
  async countActive(db: DbClient): Promise<number> {
    const res = await db
      .select({ count: count() })
      .from(candidates)
      .where(eq(candidates.isActive, 1))
      .get();
    return (res as { count: number } | null)?.count ?? 0;
  },

  // Count of candidates for a position (active-only by default)
  async countByPositionId(
    db: DbClient,
    positionId: string,
    opts: { includeInactive?: boolean } = {},
  ): Promise<number> {
    const includeInactive = opts.includeInactive ?? false;
    const where = includeInactive
      ? eq(candidates.positionId, positionId)
      : and(eq(candidates.positionId, positionId), eq(candidates.isActive, 1));
    const row = await db.select({ count: count() }).from(candidates).where(where).get();
    return (row as { count: number } | null)?.count ?? 0;
  },

  // Batch find active candidates by IDs — returns Map for O(1) lookup
  async findActiveByIds(
    db: DbClient,
    ids: string[],
  ): Promise<Map<string, { id: string; positionId: string }>> {
    const rows = await db
      .select({ id: candidates.id, positionId: candidates.positionId })
      .from(candidates)
      .where(and(inArray(candidates.id, ids), eq(candidates.isActive, 1)))
      .all();
    return new Map<string, { id: string; positionId: string }>(
      rows.map<[string, { id: string; positionId: string }]>((r) => [r.id, r]),
    );
  },

  // Insert new candidate (always active)
  async create(
    db: DbClient,
    data: {
      fullName: string;
      accountId: string;
      positionId: string;
      partyId?: string | null;
      manifesto: string;
    },
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(candidates)
      .values({
        id,
        fullName: data.fullName,
        accountId: data.accountId,
        positionId: data.positionId,
        partyId: data.partyId ?? null,
        manifesto: data.manifesto,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  },

  // Update candidate metadata. Status changes use softDelete().
  async update(
    db: DbClient,
    id: string,
    data: Partial<{
      fullName?: string;
      partyId?: string | null;
      manifesto?: string;
    }>,
  ): Promise<boolean> {
    const updateSet: Record<string, any> = {
      ...data,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    const result = await db.update(candidates).set(updateSet).where(eq(candidates.id, id)).run();
    return result.rowsAffected > 0;
  },

  // Update candidate image URL
  async updateImageUrl(db: DbClient, id: string, imageUrl: string | null): Promise<boolean> {
    const result = await db
      .update(candidates)
      .set({
        imageUrl,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(candidates.id, id))
      .run();
    return result.rowsAffected > 0;
  },

  // Soft-delete: set isActive = 0
  async softDelete(db: DbClient, id: string): Promise<boolean> {
    const result = await db
      .update(candidates)
      .set({ isActive: 0, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(candidates.id, id))
      .run();
    return result.rowsAffected > 0;
  },

  // Check if active candidate exists for the given account+position (used in create)
  async existsActiveForAccountPosition(
    db: DbClient,
    accountId: string,
    positionId: string,
  ): Promise<boolean> {
    const res = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.accountId, accountId),
          eq(candidates.positionId, positionId),
          eq(candidates.isActive, 1),
        ),
      )
      .limit(1)
      .get();
    return res !== undefined;
  },

  // Check if account is a candidate (active or deactivated)
  async isCandidate(db: DbClient, accountId: string): Promise<boolean> {
    const res = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.accountId, accountId))
      .limit(1)
      .get();
    return res !== undefined;
  },

  // Specialized query for vote results: active candidates with vote counts
  async listWithVoteCount(db: DbClient): Promise<VoteCountResult[]> {
    const rows = await db
      .select({
        candidateId: candidates.id,
        candidateName: candidates.fullName,
        positionId: candidates.positionId,
        positionName: positions.name,
        voteCount: count(votes.id),
      })
      .from(candidates)
      .leftJoin(positions, eq(candidates.positionId, positions.id))
      .leftJoin(votes, eq(candidates.id, votes.candidateId))
      .where(eq(candidates.isActive, 1))
      .groupBy(candidates.id, candidates.fullName, candidates.positionId, positions.name)
      .orderBy(desc(count(votes.id)))
      .all();
    return rows as VoteCountResult[];
  },
};
