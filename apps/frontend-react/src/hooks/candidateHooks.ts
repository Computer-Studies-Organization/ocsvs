import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { allCandidates, createCandidate } from '@/api/candidate_api'

export function useAllCandidatesQuery() {
  return useQuery({
    queryFn: allCandidates,
    queryKey: ['candidates'],
  })
}

export function useCreateCandidateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCandidate,
    mutationKey: ['candidates'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
  })
}
