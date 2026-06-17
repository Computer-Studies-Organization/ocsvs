import type { TVoteResultsResponse, TVoteStatus } from '$lib/types'
import type { VoteCountResult } from '$lib/vote-count-utils'
import { apiFetch } from './client'

export async function submitVotes(candidateIds: string[]): Promise<{ message: string }> {
  const votes = candidateIds.map(candidateId => ({ candidateId }))
  return apiFetch('/votes', { method: 'POST', body: JSON.stringify({ votes }) })
}

export async function getMyVotes(): Promise<TVoteStatus> {
  return apiFetch('/votes/me')
}

export async function getVoteResults(): Promise<TVoteResultsResponse> {
  return apiFetch('/votes/results')
}

export async function getCandidateVoteCount(candidateId: string): Promise<VoteCountResult> {
  return apiFetch(`/votes/candidates/${candidateId}/count`)
}

export interface ElectionVoteItem {
  candidateId: string
  positionId: string
}

export async function submitElectionVotes(electionId: string, votes: ElectionVoteItem[]): Promise<{ message: string }> {
  return apiFetch('/votes', { method: 'POST', body: JSON.stringify({ electionId, votes }) })
}

export async function getMyElectionVotes(): Promise<{ electionId: string | null, votes: ElectionVoteItem[] }> {
  return apiFetch('/votes/me')
}
