import type { Database } from "../repositories/database.type";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { candidates, elections, positions, votes } from "@/database/schema";

export interface ElectionWithPositions {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "archived";
  opensAt: number | null;
  closesAt: number | null;
  createdAt: number;
  updatedAt: number;
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

export interface ResultsPosition {
  positionId: string;
  positionName: string;
  displayOrder: number;
  totalVotes: number;
  candidates: Array<{
    candidateId: string;
    fullName: string;
    voteCount: number;
    percentage: number;
  }>;
}

export const electionQueries = {
  async getCurrentElection(db: Database): Promise<ElectionWithPositions | null> {
    const election = await db.select().from(elections).where(eq(elections.status, "open")).get();
    if (!election) return null;
    return this.getElectionWithPositions(db, election.id);
  },

  async getElectionWithPositions(db: Database, id: string): Promise<ElectionWithPositions | null> {
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

  async countPositions(db: Database, electionId: string): Promise<number> {
    const row = await db
      .select({ count: count() })
      .from(positions)
      .where(eq(positions.electionId, electionId))
      .get();
    return (row as { count: number } | null)?.count ?? 0;
  },

  async getResults(db: Database, electionId: string): Promise<ResultsPosition[]> {
    const rows = await db
      .select({
        positionId: positions.id,
        positionName: positions.name,
        displayOrder: positions.displayOrder,
        candidateId: candidates.id,
        candidateName: candidates.fullName,
        voteCount: count(votes.id),
      })
      .from(positions)
      .leftJoin(candidates, eq(candidates.positionId, positions.id))
      .leftJoin(votes, eq(votes.candidateId, candidates.id))
      .where(eq(positions.electionId, electionId))
      .groupBy(
        positions.id,
        positions.name,
        positions.displayOrder,
        candidates.id,
        candidates.fullName,
      )
      .orderBy(asc(positions.displayOrder), desc(count(votes.id)))
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
};
