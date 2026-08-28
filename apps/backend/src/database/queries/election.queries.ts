import type { DbClient } from "../repositories/database.type";
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  ballotSnapshots,
  candidates,
  elections,
  partyLists,
  positions,
  voterElectionParticipation,
  votes,
} from "@/database/schema";
import { electionRepo } from "@/database/repositories/election.repository";

export interface ElectionWithPositions {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "archived";
  opensAt: number | null;
  closesAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** Internal turnout metric; stripped from public responses. */
  eligibleVotersCount?: number | null;
  positions: Array<{
    id: string;
    name: string;
    displayOrder: number;
    candidates: Array<{
      id: string;
      fullName: string;
      isActive: number;
      manifesto: string;
      imageUrl: string | null;
    }>;
  }>;
}

export interface ResultsCandidate {
  candidateId: string;
  fullName: string;
  voteCount: number;
  percentage: number;
  imageUrl?: string | null;
  partyId?: string | null;
  partyName?: string | null;
  partyCode?: string | null;
  partyColor?: string | null;
}

export interface ResultsPosition {
  positionId: string;
  positionName: string;
  displayOrder: number;
  totalVotes: number;
  candidates: ResultsCandidate[];
}

export interface ElectionTurnout {
  electionId: string;
  totalEligibleVoters: number | null;
  totalBallotsCast: number | null;
  turnoutPercentage: number | null;
}

export const electionQueries = {
  async getCurrentElection(db: DbClient): Promise<ElectionWithPositions | null> {
    const election = await electionRepo.findCurrentlyOpen(db);
    if (!election) return null;
    return this.getElectionWithPositions(db, election.id);
  },

  async getElectionWithPositions(db: DbClient, id: string): Promise<ElectionWithPositions | null> {
    const election = await db.select().from(elections).where(eq(elections.id, id)).get();
    if (!election) return null;
    const positionRows = await db
      .select()
      .from(positions)
      .where(eq(positions.electionId, id))
      .orderBy(asc(positions.displayOrder), asc(positions.createdAt))
      .all();
    const positionIds = positionRows.map((p) => p.id);
    const candidateRows = positionIds.length
      ? await db
          .select()
          .from(candidates)
          .where(and(inArray(candidates.positionId, positionIds), eq(candidates.isActive, 1)))
          .all()
      : [];
    return {
      ...election,
      status: election.status as "draft" | "open" | "closed" | "archived",
      positions: positionRows.map((p) => ({
        id: p.id,
        name: p.name,
        displayOrder: p.displayOrder,
        candidates: candidateRows
          .filter((c) => c.positionId === p.id)
          .map((c) => ({
            id: c.id,
            fullName: c.fullName,
            isActive: c.isActive,
            manifesto: c.manifesto,
            imageUrl: c.imageUrl,
          })),
      })),
    };
  },

  async countPositions(db: DbClient, electionId: string): Promise<number> {
    const row = await db
      .select({ count: count() })
      .from(positions)
      .where(eq(positions.electionId, electionId))
      .get();
    return (row as { count: number } | null)?.count ?? 0;
  },

  async countPositionsWithActiveCandidates(db: DbClient, electionId: string): Promise<number> {
    const row = await db
      .select({ count: sql<number>`count(distinct ${positions.id})` })
      .from(positions)
      .innerJoin(candidates, eq(candidates.positionId, positions.id))
      .where(and(eq(positions.electionId, electionId), eq(candidates.isActive, 1)))
      .get();
    return (row as { count: number } | null)?.count ?? 0;
  },

  async getResults(db: DbClient, electionId: string): Promise<ResultsPosition[]> {
    const rows = await db
      .select({
        positionId: positions.id,
        positionName: positions.name,
        displayOrder: positions.displayOrder,
        candidateId: candidates.id,
        candidateName: candidates.fullName,
        candidateImageUrl: candidates.imageUrl,
        partyId: partyLists.id,
        partyName: partyLists.name,
        partyCode: partyLists.code,
        partyColor: partyLists.color,
        voteCount: count(votes.id),
      })
      .from(positions)
      .leftJoin(candidates, eq(candidates.positionId, positions.id))
      .leftJoin(partyLists, eq(candidates.partyId, partyLists.id))
      .leftJoin(votes, and(eq(votes.candidateId, candidates.id), eq(votes.electionId, electionId)))
      .where(eq(positions.electionId, electionId))
      .groupBy(
        positions.id,
        positions.name,
        positions.displayOrder,
        positions.createdAt,
        candidates.id,
        candidates.fullName,
        candidates.imageUrl,
        partyLists.id,
        partyLists.name,
        partyLists.code,
        partyLists.color,
      )
      .orderBy(asc(positions.displayOrder), asc(positions.createdAt), desc(count(votes.id)))
      .all();

    const byPosition = new Map<string, ResultsPosition>();
    for (const r of rows) {
      if (!byPosition.has(r.positionId)) {
        byPosition.set(r.positionId, {
          positionId: r.positionId,
          positionName: r.positionName,
          displayOrder: r.displayOrder,
          totalVotes: 0,
          candidates: [],
        });
      }
      const slot = byPosition.get(r.positionId)!;
      if (r.candidateId) {
        slot.candidates.push({
          candidateId: r.candidateId,
          fullName: r.candidateName ?? "",
          voteCount: r.voteCount,
          percentage: 0,
          imageUrl: r.candidateImageUrl ?? null,
          partyId: r.partyId ?? null,
          partyName: r.partyName ?? null,
          partyCode: r.partyCode ?? null,
          partyColor: r.partyColor ?? null,
        });
      }
    }
    for (const slot of byPosition.values()) {
      const total = slot.candidates.reduce((s, c) => s + c.voteCount, 0);
      slot.totalVotes = total;
      for (const c of slot.candidates) {
        c.percentage = total > 0 ? Math.round((c.voteCount / total) * 10000) / 100 : 0;
      }
    }
    return Array.from(byPosition.values());
  },

  async getTurnout(db: DbClient, electionId: string): Promise<ElectionTurnout> {
    const [electionResult, snapshotsResult, participationResult, legacyResult, voteResult] =
      await Promise.all([
        db
          .select({ eligibleVotersCount: elections.eligibleVotersCount })
          .from(elections)
          .where(eq(elections.id, electionId))
          .get(),
        db
          .select({ count: count() })
          .from(ballotSnapshots)
          .where(eq(ballotSnapshots.electionId, electionId))
          .get(),
        db
          .select({ count: count() })
          .from(voterElectionParticipation)
          .where(eq(voterElectionParticipation.electionId, electionId))
          .get(),
        db
          .select({ count: sql<number>`count(distinct ${votes.userId})` })
          .from(votes)
          .where(and(eq(votes.electionId, electionId), isNotNull(votes.userId)))
          .get(),
        db.select({ count: count() }).from(votes).where(eq(votes.electionId, electionId)).get(),
      ]);

    const participationCount = Number(participationResult?.count ?? 0);
    const legacyBallotCount = Number(legacyResult?.count ?? 0);
    const voteCount = Number(voteResult?.count ?? 0);
    const snapshotCount = Number(snapshotsResult?.count ?? 0);

    // Participation and linked legacy ballots are disjoint during the
    // anonymisation window. Snapshots overlap new participation, so use them
    // only when no voter-level source exists. Anonymous vote rows alone cannot
    // reveal how many ballots they represent.
    const totalBallotsCast =
      participationCount > 0 || legacyBallotCount > 0
        ? participationCount + legacyBallotCount
        : snapshotCount > 0
          ? snapshotCount
          : voteCount > 0
            ? null
            : 0;
    const totalEligibleVoters = electionResult?.eligibleVotersCount ?? null;
    const turnoutPercentage =
      totalEligibleVoters !== null && totalBallotsCast !== null && totalEligibleVoters > 0
        ? Math.round((totalBallotsCast / totalEligibleVoters) * 10000) / 100
        : totalEligibleVoters === 0 && totalBallotsCast !== null
          ? 0
          : null;

    return {
      electionId,
      totalEligibleVoters,
      totalBallotsCast,
      turnoutPercentage,
    };
  },
};
