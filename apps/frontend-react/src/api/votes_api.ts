import type { TVoteResultsResponse, TVoteStatus } from "@/@types";
import { api } from "./axios";

export async function submitVotes(candidateIds: string[]) {
  const votes = candidateIds.map((candidateId) => ({ candidateId }));
  const response = await api.post("/votes", { votes });
  return response.data;
}

export async function getMyVotes(): Promise<TVoteStatus> {
  const response = await api.get("/votes/me");
  return response.data;
}

export async function getVoteResults(): Promise<TVoteResultsResponse> {
  const response = await api.get("/votes/results");
  return response.data;
}

export async function getCandidateVoteCount(
  candidateId: string,
): Promise<{ candidateId: string; candidateName: string; position: string; voteCount: number }> {
  const response = await api.get(`/votes/candidates/${candidateId}/count`);
  return response.data;
}
