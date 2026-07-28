import type { DbClient } from "../repositories/database.type";
import type { ResultsPosition } from "@/database/queries/election.queries";
import { electionRepo, type ElectionRow } from "@/database/repositories/election.repository";
import { electionQueries } from "@/database/queries/election.queries";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { voteRepo } from "@/database/repositories/votes.repository";

export interface NextDraft {
  id: string;
  name: string;
  opensAt: number | null;
  closesAt: number | null;
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

export async function getVotingState(db: DbClient, accountId: string): Promise<VotingState> {
  const now = Math.floor(Date.now() / 1000);
  const [dbOpen, draftRow, closedRow] = await Promise.all([
    electionRepo.findOpen(db),
    electionRepo.findEarliestDraft(db),
    electionRepo.findLatestClosed(db),
  ]);

  let open: typeof dbOpen = dbOpen;
  let virtualDraft = draftRow;
  let virtualClosed = closedRow;

  // "Virtualize" an election whose status='open' is out of sync with its time
  // window (admin transitioned early, or forgot to close) by demoting it into
  // the right UI slot. The DB row is left alone — only the response shape
  // reflects what the wall clock says.
  if (dbOpen) {
    if (dbOpen.opensAt !== null && now < dbOpen.opensAt) {
      open = null;
      if (!virtualDraft || virtualDraft.opensAt === null || dbOpen.opensAt < virtualDraft.opensAt) {
        virtualDraft = dbOpen;
      }
    } else if (dbOpen.closesAt !== null && now > dbOpen.closesAt) {
      open = null;
      if (
        !virtualClosed ||
        virtualClosed.closesAt === null ||
        dbOpen.closesAt > virtualClosed.closesAt
      ) {
        virtualClosed = dbOpen;
      }
    }
  }

  let nextDraft: NextDraft | null = null;
  if (virtualDraft) {
    nextDraft = {
      id: virtualDraft.id,
      name: virtualDraft.name,
      opensAt: virtualDraft.opensAt,
      closesAt: virtualDraft.closesAt,
    };
  }

  let lastClosed: LastClosed | null = null;
  if (virtualClosed && virtualClosed.closesAt !== null) {
    const results = await electionQueries.getResults(db, virtualClosed.id);
    lastClosed = {
      id: virtualClosed.id,
      name: virtualClosed.name,
      closesAt: virtualClosed.closesAt,
      results,
    };
  }

  const myVotes = await getMyVotesForOpen(db, accountId, open?.id ?? null);

  return { open, nextDraft, lastClosed, myVotes };
}

async function getMyVotesForOpen(
  db: DbClient,
  accountId: string,
  openId: string | null,
): Promise<MyVotes> {
  if (!openId) {
    return { electionId: null, votes: [] };
  }
  const user = await voterAccountStore.findByAccountId(db, accountId);
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
