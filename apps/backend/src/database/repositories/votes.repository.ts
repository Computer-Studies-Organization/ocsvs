import type { Database } from './database.type'
import { eq } from 'drizzle-orm'
import { votes } from '@/database/schema'

export const voteRepo = {
  // Find all votes for a user
  async findByUserId(
    db: Database,
    userId: string,
  ): Promise<(typeof votes.$inferSelect)[]> {
    return await db
      .select()
      .from(votes)
      .where(eq(votes.userId, userId))
      .all()
  },

  // Check if user has any votes
  async existsForUser(
    db: Database,
    userId: string,
  ): Promise<boolean> {
    const result = await db
      .select({ id: votes.id })
      .from(votes)
      .where(eq(votes.userId, userId))
      .limit(1)
      .get()
    return result !== null
  },

  // Get vote count for a candidate
  async countByCandidateId(
    db: Database,
    candidateId: string,
  ): Promise<number> {
    const rows = await db
      .select()
      .from(votes)
      .where(eq(votes.candidateId, candidateId))
      .all()
    return rows.length
  },
}
