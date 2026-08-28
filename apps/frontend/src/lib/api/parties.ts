import type { TPartyList } from "$lib/types";
import { apiFetch, type ApiFetchOptions } from "./client";

export async function listPartyLists(
  electionId: string,
  options?: ApiFetchOptions,
): Promise<TPartyList[]> {
  return apiFetch<TPartyList[]>(`/elections/${electionId}/parties`, options);
}

export async function createPartyList(
  electionId: string,
  body: { name: string; code: string; color?: string | null; description?: string | null },
): Promise<TPartyList> {
  return apiFetch<TPartyList>(`/elections/${electionId}/parties`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePartyList(
  electionId: string,
  partyId: string,
  body: Partial<{ name: string; code: string; color?: string | null; description?: string | null }>,
): Promise<TPartyList> {
  return apiFetch<TPartyList>(`/elections/${electionId}/parties/${partyId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deletePartyList(
  electionId: string,
  partyId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/elections/${electionId}/parties/${partyId}`, {
    method: "DELETE",
  });
}
