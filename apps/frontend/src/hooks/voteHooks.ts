import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCandidateVoteCount, getMyVotes, getVoteResults, submitVotes } from '@/api/votes_api'

export function useSubmitVotesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: submitVotes,
    mutationKey: ['votes'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['votes'] })
      queryClient.invalidateQueries({ queryKey: ['myVotes'] })
      queryClient.invalidateQueries({ queryKey: ['voteResults'] })
    },
  })
}

export function useMyVotesQuery() {
  return useQuery({
    queryFn: getMyVotes,
    queryKey: ['myVotes'],
    staleTime: 1000 * 60 * 5,
  })
}

export function useVoteResultsQuery() {
  return useQuery({
    queryFn: getVoteResults,
    queryKey: ['voteResults'],
    staleTime: 1000 * 60 * 2,
  })
}

export function useCandidateVoteCountQuery(candidateId: string | null) {
  return useQuery({
    queryFn: () => getCandidateVoteCount(candidateId!),
    queryKey: ['candidateVoteCount', candidateId],
    enabled: !!candidateId,
    staleTime: 1000 * 60 * 2,
  })
}
