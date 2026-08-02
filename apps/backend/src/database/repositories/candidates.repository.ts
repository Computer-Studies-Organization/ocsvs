import type { DbClient } from "./database.type";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { candidates, elections, positions, votes } from "@/database/schema";

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
    opts: {
      page?: number;
      limit?: number;
      includeInactive?: boolean;
      positionId?: string;
      electionId?: string;
      excludeDraft?: boolean;
    } = {},
  ): Promise<AdminListResult> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 10;
    const includeInactive = opts.includeInactive ?? false;
    const positionId = opts.positionId;
    const electionId = opts.electionId;
    const excludeDraft = opts.excludeDraft ?? false;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (!includeInactive) {
      conditions.push(eq(candidates.isActive, 1));
    }
    if (positionId) {
      conditions.push(eq(candidates.positionId, positionId));
    }
    if (electionId) {
      conditions.push(eq(positions.electionId, electionId));
    }
    if (excludeDraft) {
      conditions.push(ne(elections.status, "draft"));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
      .from(candidates);

    if (electionId || excludeDraft) {
      dataQuery.innerJoin(positions, eq(candidates.positionId, positions.id));
    }
    if (excludeDraft) {
      dataQuery.innerJoin(elections, eq(positions.electionId, elections.id));
    }

    const countQuery = db.select({ count: count() }).from(candidates);
    if (electionId || excludeDraft) {
      countQuery.innerJoin(positions, eq(candidates.positionId, positions.id));
    }
    if (excludeDraft) {
      countQuery.innerJoin(elections, eq(positions.electionId, elections.id));
    }

    const [data, totalRaw] = await Promise.all([
      whereClause
        ? dataQuery
            .where(whereClause)
            .orderBy(desc(candidates.createdAt), desc(candidates.id))
            .limit(limit)
            .offset(offset)
            .all()
        : dataQuery
            .orderBy(desc(candidates.createdAt), desc(candidates.id))
            .limit(limit)
            .offset(offset)
            .all(),
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
    opts: { includeInactive?: boolean; excludeDraft?: boolean } = {},
  ): Promise<CandidateRow | null> {
    const includeInactive = opts.includeInactive ?? false;
    const excludeDraft = opts.excludeDraft ?? false;
    const candidateWhere = includeInactive
      ? eq(candidates.id, id)
      : and(eq(candidates.id, id), eq(candidates.isActive, 1));
    const whereClause = excludeDraft
      ? and(candidateWhere, ne(elections.status, "draft"))
      : candidateWhere;

    const query = db
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
      .from(candidates);

    if (excludeDraft) {
      query.innerJoin(positions, eq(candidates.positionId, positions.id));
      query.innerJoin(elections, eq(positions.electionId, elections.id));
    }

    return ((await query.where(whereClause).get()) as CandidateRow | undefined) ?? null;
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

  // Check whether a party already has an active candidate for a position.
  // excludeCandidateId keeps a candidate's unchanged party assignment valid on update.
  async existsActiveForPartyPosition(
    db: DbClient,
    partyId: string,
    positionId: string,
    excludeCandidateId?: string,
  ): Promise<boolean> {
    const conditions = [
      eq(candidates.partyId, partyId),
      eq(candidates.positionId, positionId),
      eq(candidates.isActive, 1),
    ];
    if (excludeCandidateId) {
      conditions.push(ne(candidates.id, excludeCandidateId));
    }
    const res = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(...conditions))
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
