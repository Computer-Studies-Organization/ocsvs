import type { TCandidate } from "$lib/types";
import { apiFetch } from "./client";

export interface AllCandidatesOpts {
  electionId: string;
  positionId?: string;
  includeInactive?: boolean;
}

export async function allCandidates(opts: AllCandidatesOpts): Promise<{
  data: TCandidate[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}> {
  let allData: TCandidate[] = [];
  let page = 1;
  const limit = 100;
  let hasMore = true;

  const baseParams = new URLSearchParams();
  baseParams.set("electionId", opts.electionId);
  if (opts.positionId) {
    baseParams.set("positionId", opts.positionId);
  }
  if (opts.includeInactive) {
    baseParams.set("includeInactive", "true");
  }
  baseParams.set("page", String(page));
  baseParams.set("limit", String(limit));

  while (hasMore) {
    baseParams.set("page", String(page));
    const response = await apiFetch<{ data: TCandidate[]; meta: { totalPages: number } }>(
      `/candidates?${baseParams.toString()}`,
    );
    allData = [...allData, ...response.data];
    hasMore = page < response.meta.totalPages;
    page++;
  }

  return {
    data: allData,
    meta: { total: allData.length, page: 1, limit: allData.length, totalPages: 1 },
  };
}

export async function getCandidate(id: string): Promise<TCandidate> {
  return apiFetch(`/candidates/${id}`);
}

export async function createCandidate(data: Omit<TCandidate, "id">): Promise<TCandidate> {
  return apiFetch("/candidates", { method: "POST", body: JSON.stringify(data) });
}

export async function updateCandidate(
  id: string,
  data: { fullName?: string; manifesto?: string; isActive?: number },
): Promise<TCandidate> {
  const res = await apiFetch<{ message: string; candidate: TCandidate }>(`/candidates/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.candidate;
}

export async function deleteCandidate(id: string): Promise<{ message: string }> {
  return apiFetch(`/candidates/${id}`, { method: "DELETE" });
}

export async function uploadCandidateImage(candidateId: string, file: File): Promise<TCandidate> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await apiFetch<{ message: string; candidate: TCandidate }>(
    `/candidates/${candidateId}/image`,
    {
      method: "POST",
      body: formData,
      // Don't set Content-Type - browser sets it with boundary for FormData
    },
  );
  return res.candidate;
}

export async function deleteCandidateImage(candidateId: string): Promise<TCandidate> {
  const res = await apiFetch<{ message: string; candidate: TCandidate }>(
    `/candidates/${candidateId}/image`,
    {
      method: "DELETE",
    },
  );
  return res.candidate;
}
