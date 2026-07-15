import type { TPosition } from "$lib/types";
import { apiFetch, type ApiFetchOptions } from "./client";

export async function listPositions(
  electionId: string,
  options?: ApiFetchOptions,
): Promise<TPosition[]> {
  return apiFetch<TPosition[]>(`/elections/${electionId}/positions`, options);
}

export async function createPosition(
  electionId: string,
  body: { name: string; displayOrder?: number },
): Promise<TPosition> {
  return apiFetch<TPosition>(`/elections/${electionId}/positions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePosition(
  electionId: string,
  positionId: string,
  body: Partial<{ name: string; displayOrder: number }>,
): Promise<TPosition> {
  return apiFetch<TPosition>(`/elections/${electionId}/positions/${positionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deletePosition(
  electionId: string,
  positionId: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/elections/${electionId}/positions/${positionId}`, {
    method: "DELETE",
  });
}
