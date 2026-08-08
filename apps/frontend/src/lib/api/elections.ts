import type { TElection, TElectionStatus, TResults, TVotingState } from "$lib/types";
import { apiFetch, type ApiFetchOptions } from "./client";

export async function listElections(
  status?: TElectionStatus,
  options?: ApiFetchOptions,
): Promise<TElection[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<TElection[]>(`/elections${qs}`, options);
}

export async function getElection(id: string, options?: ApiFetchOptions): Promise<TElection> {
  return apiFetch<TElection>(`/elections/${id}`, options);
}

export async function createElection(body: {
  name: string;
  description?: string;
  opensAt?: number;
  closesAt?: number;
}): Promise<TElection> {
  return apiFetch<TElection>("/elections", { method: "POST", body: JSON.stringify(body) });
}

export async function updateElection(
  id: string,
  body: Partial<{
    name: string;
    description: string | null;
    opensAt: number | null;
    closesAt: number | null;
  }>,
): Promise<TElection> {
  return apiFetch<TElection>(`/elections/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function transitionElection(
  id: string,
  body: { to: TElectionStatus; opensAt?: number; closesAt?: number },
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/elections/${id}/transitions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listResults(
  electionId: string,
  options?: ApiFetchOptions,
): Promise<TResults> {
  return apiFetch<TResults>(`/elections/${electionId}/results`, options);
}

export async function getVotingState(
  options?: ApiFetchOptions,
  includeBallot = false,
): Promise<TVotingState> {
  const path = includeBallot ? "/elections/state?includeBallot=true" : "/elections/state";
  return apiFetch<TVotingState>(path, options);
}
