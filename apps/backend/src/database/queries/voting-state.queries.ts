import type { Database } from "../repositories/database.type";
import type { ResultsPosition } from "@/database/queries/election.queries";
import { electionRepo, type ElectionRow } from "@/database/repositories/election.repository";
import { electionQueries } from "@/database/queries/election.queries";
import { userRepo } from "@/database/repositories/users.repository";
import { voteRepo } from "@/database/repositories/votes.repository";

export interface NextDraft {
  id: string;
  name: string;
  opensAt: number;
  closesAt: number;
}

export interface LastClosed {
  id: string;
  name: string;
  closesAt: number;
  results: ResultsPosition[];
}

export interface MyVotes {
  electionId: string | null;
  votes: Array<{ candidateId: string; positionId: string }>;
}

export interface VotingState {
  open: ElectionRow | null;
  nextDraft: NextDraft | null;
  lastClosed: LastClosed | null;
  myVotes: MyVotes;
}

export async function getVotingState(db: Database, accountId: string): Promise<VotingState> {
  const [open, draftRow, closedRow] = await Promise.all([
    electionRepo.findOpen(db),
    electionRepo.findEarliestDraft(db),
    electionRepo.findLatestClosed(db),
  ]);

  let nextDraft: NextDraft | null = null;
  if (draftRow && draftRow.opensAt !== null) {
    nextDraft = {
      id: draftRow.id,
      name: draftRow.name,
      opensAt: draftRow.opensAt,
      closesAt: draftRow.closesAt ?? draftRow.opensAt,
    };
  }

  let lastClosed: LastClosed | null = null;
  if (closedRow && closedRow.closesAt !== null) {
    const results = await electionQueries.getResults(db, closedRow.id);
    lastClosed = {
      id: closedRow.id,
      name: closedRow.name,
      closesAt: closedRow.closesAt,
      results,
    };
  }

  const myVotes = await getMyVotesForOpen(db, accountId, open?.id ?? null);

  return { open, nextDraft, lastClosed, myVotes };
}

async function getMyVotesForOpen(
  db: Database,
  accountId: string,
  openId: string | null,
): Promise<MyVotes> {
  if (!openId) {
    return { electionId: null, votes: [] };
  }
  const user = await userRepo.findByAccountId(db, accountId);
  if (!user) {
    return { electionId: openId, votes: [] };
  }
  const rows = await voteRepo.findByUserAndElection(db, user.id, openId);
  return {
    electionId: openId,
    votes: rows.map((r) => ({
      candidateId: r.candidateId,
      positionId: r.positionId,
    })),
  };
}