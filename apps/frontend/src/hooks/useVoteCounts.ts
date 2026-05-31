import { useQueries } from '@tanstack/react-query'
import { getCandidateVoteCount } from '@/api/votes_api'
import { mergeVoteCounts } from './vote-count-utils'

export function useVoteCounts(candidateIds: string[] | undefined) {
  const queries = useQueries({
    queries: (candidateIds ?? []).map(id => ({
      queryKey: ['voteCount', id],
      queryFn: () => getCandidateVoteCount(id),
      staleTime: 2 * 60 * 1000,
    })),
  })

  const { voteCounts, isLoading } = mergeVoteCounts(candidateIds ?? [], queries)
  const isError = queries.some(q => q.isError)
  const error = queries.find(q => q.error)?.error ?? null

  return { voteCounts, isLoading, isError, error }
}
