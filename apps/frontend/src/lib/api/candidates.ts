import type { TCandidate } from '$lib/types'
import { apiFetch } from './client'

export async function allCandidates(): Promise<{ data: TCandidate[], meta: { total: number, page: number, limit: number, totalPages: number } }> {
  let allCandidatesData: TCandidate[] = []
  let page = 1
  const limit = 100
  let hasMore = true

  while (hasMore) {
    const response = await apiFetch<{ data: TCandidate[], meta: { totalPages: number } }>(
      `/candidates?page=${page}&limit=${limit}`,
    )
    allCandidatesData = [...allCandidatesData, ...response.data]
    hasMore = page < response.meta.totalPages
    page++
  }

  return {
    data: allCandidatesData,
    meta: { total: allCandidatesData.length, page: 1, limit: allCandidatesData.length, totalPages: 1 },
  }
}

export async function createCandidate(data: Omit<TCandidate, 'id'>): Promise<TCandidate> {
  return apiFetch('/candidates', { method: 'POST', body: JSON.stringify(data) })
}
