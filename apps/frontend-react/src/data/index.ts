import type { TCandidate } from '@/@types'
import { useMemo } from 'react'
import { useAllCandidatesQuery } from '@/hooks/candidateHooks'

export function useAllCandidates(): TCandidate[] {
  const { data } = useAllCandidatesQuery()

  return useMemo(() => {
    if (!data?.data || !Array.isArray(data.data)) {
      return []
    }

    return data.data as TCandidate[]
  }, [data])
}
