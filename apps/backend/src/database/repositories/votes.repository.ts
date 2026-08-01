import type { DbClient } from "./database.type";
import { and, count, eq } from "drizzle-orm";
import { voterElectionParticipation, votes } from "@/database/schema";

export const voteRepo = {
  // Check if voterHash has already participated in an election
  async hasVoterHashParticipated(
    db: DbClient,
    electionId: string,
    voterHash: string,
  ): Promise<boolean> {
    const result = await db
      .select({ id: voterElectionParticipation.id })
      .from(voterElectionParticipation)
      .where(
        and(
          eq(voterElectionParticipation.electionId, electionId),
          eq(voterElectionParticipation.voterHash, voterHash),
        ),
      )
      .limit(1)
      .get();
    return result !== undefined;
  },
  // Find all votes for a user in a specific election
  async findByUserAndElection(
    db: DbClient,
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
  async findByUserId(db: DbClient, userId: string): Promise<(typeof votes.$inferSelect)[]> {
    return await db.select().from(votes).where(eq(votes.userId, userId)).all();
  },

  // Check if user has any votes
  async existsForUser(db: DbClient, userId: string): Promise<boolean> {
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
    db: DbClient,
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
  async countByCandidateId(db: DbClient, candidateId: string): Promise<number> {
    const row = await db
      .select({ count: count() })
      .from(votes)
      .where(eq(votes.candidateId, candidateId))
      .get();
    return row?.count ?? 0;
  },

  // Insert a single vote and return its id
  async insert(
    db: DbClient,
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
