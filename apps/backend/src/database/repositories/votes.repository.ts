import type { DbClient } from "./database.type";
import { and, count, eq, inArray } from "drizzle-orm";
import { voterElectionParticipation, votes } from "@/database/schema";

export const voteRepo = {
  // Check if any of the voterHashes have already participated in an election
  async hasVoterHashParticipated(
    db: DbClient,
    electionId: string,
    voterHashes: string[],
  ): Promise<boolean> {
    const result = await db
      .select({ id: voterElectionParticipation.id })
      .from(voterElectionParticipation)
      .where(
        and(
          eq(voterElectionParticipation.electionId, electionId),
          inArray(voterElectionParticipation.voterHash, voterHashes),
        ),
      )
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
};
