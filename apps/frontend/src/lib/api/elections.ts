import type { TElection, TElectionStatus, TResults, TVotingState } from "$lib/types";
import { apiFetch, type ApiFetchOptions } from "./client";

export async function listElections(
  status?: TElectionStatus,
  options?: ApiFetchOptions,
): Promise<TElection[]> {
  const qs = status ? `?status=${status}` : "";
  return apiFetch<TElection[]>(`/elections${qs}`, options);
}

export async function getCurrentElection(options?: ApiFetchOptions): Promise<TElection | null> {
  try {
    return await apiFetch<TElection>("/elections/current", options);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      return null;
    }
    throw err;
  }
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
  body: Partial<{ name: string; description: string; opensAt: number; closesAt: number }>,
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

export async function getVotingState(options?: ApiFetchOptions): Promise<TVotingState> {
  return apiFetch<TVotingState>("/elections/state", options);
}
