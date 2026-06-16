import type { Database } from './database.type'
import { eq } from 'drizzle-orm'
import { users } from '@/database/schema'

/**
 * Pure single-table operations on the `users` table.
 * For joined queries (users + accounts), see userAccountQueries.
 *
 * Note: Voting status is no longer a column on `users`. It is derived from
 * the `votes` table — see `voteRepo.existsForUser` and the
 * `votes_user_position_election_unique_idx` unique index.
 */
export const userRepo = {
  /** Find user by account ID (single table) */
  async findByAccountId(
    db: Database,
    accountId: string,
  ): Promise<typeof users.$inferSelect | null> {
    return await db
      .select()
      .from(users)
      .where(eq(users.accountId, accountId))
      .get() ?? null
  },

  /** Get account ID for a user (single table) */
  async getAccountId(
    db: Database,
    userId: string,
  ): Promise<{ accountId: string } | null> {
    return await db
      .select({ accountId: users.accountId })
      .from(users)
      .where(eq(users.id, userId))
      .get() ?? null
  },

  /** Update user profile fields (single table) */
  async updateUser(
    db: Database,
    userId: string,
    data: Partial<{
      firstName: string
      lastName: string
      yearLevel: string
      course: string
    }>,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    await db
      .update(users)
      .set({ ...data, updatedAt: now })
      .where(eq(users.id, userId))
      .run()
  },
}
