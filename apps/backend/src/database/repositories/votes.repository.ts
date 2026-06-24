import type { Database } from "./database.type";
import { and, count, eq } from "drizzle-orm";
import { votes } from "@/database/schema";

export const voteRepo = {
  // Find all votes for a user in a specific election
  async findByUserAndElection(
    db: Database,
    userId: string,
    electionId: string,
  ): Promise<(typeof votes.$inferSelect)[]> {
    return await db
      .select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.electionId, electionId)))
      .all();
  },

  // Find all votes for a user
  async findByUserId(db: Database, userId: string): Promise<(typeof votes.$inferSelect)[]> {
    return await db.select().from(votes).where(eq(votes.userId, userId)).all();
  },

  // Check if user has any votes
  async existsForUser(db: Database, userId: string): Promise<boolean> {
    const result = await db
      .select({ id: votes.id })
      .from(votes)
      .where(eq(votes.userId, userId))
      .limit(1)
      .get();
    return result !== undefined;
  },

  // Check if user has any vote in a specific election
  async existsForUserInElection(
    db: Database,
    userId: string,
    electionId: string,
  ): Promise<boolean> {
    const result = await db
      .select({ id: votes.id })
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.electionId, electionId)))
      .limit(1)
      .get();
    return result !== undefined;
  },

  // Get vote count for a candidate
  async countByCandidateId(db: Database, candidateId: string): Promise<number> {
    const row = await db
      .select({ count: count() })
      .from(votes)
      .where(eq(votes.candidateId, candidateId))
      .get();
    return row?.count ?? 0;
  },

  // Insert a single vote and return its id
  async insert(
    db: Database,
    data: {
      userId: string;
      candidateId: string;
      positionId: string;
      electionId: string;
    },
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(votes)
      .values({
        id,
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  },
};
