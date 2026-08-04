import { apiFetch } from "./client";

export interface ElectionVoteItem {
  candidateId: string;
  positionId: string;
}

export async function submitElectionVotes(
  electionId: string,
  votes: ElectionVoteItem[],
): Promise<{ message: string }> {
  return apiFetch("/votes", { method: "POST", body: JSON.stringify({ electionId, votes }) });
}

export async function getMyElectionVotes(): Promise<{
  electionId: string | null;
  votes: ElectionVoteItem[];
}> {
  return apiFetch("/votes/me");
}
