import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { candidates, votes } from '@/database/schema'

export type Database = DrizzleD1Database<typeof import('@/database/schema')>
export type CandidateRow = typeof candidates.$inferSelect

export interface AdminListResult {
  data: CandidateRow[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface VoteCountResult {
  candidateId: string
  candidateName: string
  position: string
  voteCount: number
}

export const candidateRepo = {
  // Ballot: minimal fields, active-only
  async listForBallot(
    db: Database,
  ): Promise<{ id: string, fullName: string, position: string }[]> {
    return await db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        position: candidates.position,
      })
      .from(candidates)
      .where(eq(candidates.isActive, 1))
      .all()
  },

  // Admin table: full candidate records, paginated, optional inactive include
  async listForAdminTable(
    db: Database,
    opts: { page?: number, limit?: number, includeInactive?: boolean } = {},
  ): Promise<AdminListResult> {
    const page = opts.page ?? 1
    const limit = opts.limit ?? 10
    const includeInactive = opts.includeInactive ?? false
    const offset = (page - 1) * limit

    const whereClause = includeInactive
      ? undefined
      : eq(candidates.isActive, 1)

    const [data, totalRaw] = await Promise.all([
      db
        .select({
          id: candidates.id,
          fullName: candidates.fullName,
          accountId: candidates.accountId,
          position: candidates.position,
          manifesto: candidates.manifesto,
          isActive: candidates.isActive,
          createdAt: candidates.createdAt,
          updatedAt: candidates.updatedAt,
        })
        .from(candidates)
        .where(whereClause)
        .orderBy(desc(candidates.createdAt), desc(candidates.id))
        .limit(limit)
        .offset(offset)
        .all(),
      db.select({ count: count() }).from(candidates).where(whereClause).get(),
    ])

    const total = (totalRaw as { count: number } | null)?.count ?? 0
    const totalPages = Math.ceil(total / limit)

    return { data, meta: { total, page, limit, totalPages } }
  },

  // Single-candidate read for vote validation (active-only, minimal fields)
  async getForValidation(
    db: Database,
    id: string,
  ): Promise<{ id: string, position: string } | null> {
    return await db
      .select({ id: candidates.id, position: candidates.position })
      .from(candidates)
      .where(and(eq(candidates.id, id), eq(candidates.isActive, 1)))
      .get()
  },

  // Single-candidate full view for admin (optionally include inactive)
  async getForAdminView(
    db: Database,
    id: string,
    opts: { includeInactive?: boolean } = {},
  ): Promise<CandidateRow | null> {
    const includeInactive = opts.includeInactive ?? false
    const whereClause = includeInactive
      ? eq(candidates.id, id)
      : and(eq(candidates.id, id), eq(candidates.isActive, 1))

    return await db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        accountId: candidates.accountId,
        position: candidates.position,
        manifesto: candidates.manifesto,
        isActive: candidates.isActive,
        createdAt: candidates.createdAt,
        updatedAt: candidates.updatedAt,
      })
      .from(candidates)
      .where(whereClause)
      .get()
  },

  // Count of active candidates
  async countActive(db: Database): Promise<number> {
    const res = await db
      .select({ count: count() })
      .from(candidates)
      .where(eq(candidates.isActive, 1))
      .get()
    return (res as { count: number } | null)?.count ?? 0
  },

  // Batch find active candidates by IDs — returns Map for O(1) lookup
  async findActiveByIds(
    db: Database,
    ids: string[],
  ): Promise<Map<string, { id: string, position: string }>> {
    const rows = await db
      .select({ id: candidates.id, position: candidates.position })
      .from(candidates)
      .where(and(inArray(candidates.id, ids), eq(candidates.isActive, 1)))
      .all()
    return new Map<string, { id: string, position: string }>(
      rows.map<[string, { id: string, position: string }]>(r => [r.id, r]),
    )
  },

  // Insert new candidate (always active)
  async create(
    db: Database,
    data: {
      fullName: string
      accountId: string
      position: string
      manifesto: string
    },
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)
    await db
      .insert(candidates)
      .values({
        id,
        fullName: data.fullName,
        accountId: data.accountId,
        position: data.position,
        manifesto: data.manifesto,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    return id
  },

  // Update candidate (preserves isActive unless explicitly updated)
  async update(
    db: Database,
    id: string,
    data: Partial<{
      fullName?: string
      accountId?: string
      position?: string
      manifesto?: string
      isActive?: number
    }>,
  ): Promise<boolean> {
    const updateSet: Record<string, any> = {
      ...data,
      updatedAt: Math.floor(Date.now() / 1000),
    }
    const result = await db
      .update(candidates)
      .set(updateSet)
      .where(eq(candidates.id, id))
      .run()
    return result.changes > 0
  },

  // Soft-delete: set isActive = 0
  async softDelete(db: Database, id: string): Promise<boolean> {
    const result = await db
      .update(candidates)
      .set({ isActive: 0, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(candidates.id, id))
      .run()
    return result.changes > 0
  },

  // Check if active candidate exists for the given account+position (used in create)
  async existsActiveForAccountPosition(
    db: Database,
    accountId: string,
    position: string,
  ): Promise<boolean> {
    const res = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.accountId, accountId),
          eq(candidates.position, position),
          eq(candidates.isActive, 1),
        ),
      )
      .limit(1)
      .get()
    return res !== null
  },

  // Specialized query for vote results: active candidates with vote counts
  async listWithVoteCount(db: Database): Promise<VoteCountResult[]> {
    const rows = await db
      .select({
        candidateId: candidates.id,
        candidateName: candidates.fullName,
        position: candidates.position,
        voteCount: count(votes.id),
      })
      .from(candidates)
      .leftJoin(votes, eq(candidates.id, votes.candidateId))
      .where(eq(candidates.isActive, 1))
      .groupBy(candidates.id, candidates.fullName, candidates.position)
      .orderBy(desc(count(votes.id)))
      .all()
    return rows as VoteCountResult[]
  },
}
