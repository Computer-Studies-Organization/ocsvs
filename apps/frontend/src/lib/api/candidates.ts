import type { TCandidate } from '$lib/types'
import { apiFetch } from './client'

export interface AllCandidatesOpts {
  electionId: string
  positionId?: string
  includeInactive?: boolean
}

export async function allCandidates(opts: AllCandidatesOpts): Promise<{ data: TCandidate[], meta: { total: number, page: number, limit: number, totalPages: number } }> {
  let allData: TCandidate[] = []
  let page = 1
  const limit = 100
  let hasMore = true

  const baseParams = new URLSearchParams()
  baseParams.set('electionId', opts.electionId)
  if (opts.positionId) {
    baseParams.set('positionId', opts.positionId)
  }
  if (opts.includeInactive) {
    baseParams.set('includeInactive', 'true')
  }
  baseParams.set('page', String(page))
  baseParams.set('limit', String(limit))

  while (hasMore) {
    baseParams.set('page', String(page))
    const response = await apiFetch<{ data: TCandidate[], meta: { totalPages: number } }>(
      `/candidates?${baseParams.toString()}`,
    )
    allData = [...allData, ...response.data]
    hasMore = page < response.meta.totalPages
    page++
  }

  return {
    data: allData,
    meta: { total: allData.length, page: 1, limit: allData.length, totalPages: 1 },
  }
}

export async function createCandidate(data: Omit<TCandidate, 'id'>): Promise<TCandidate> {
  return apiFetch('/candidates', { method: 'POST', body: JSON.stringify(data) })
}
