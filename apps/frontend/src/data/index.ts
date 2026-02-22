import type { TCandidate } from "@/@types"
import { useAllCandidatesQuery } from "@/hooks/candidateHooks"
import { useMemo } from "react"

export const useAllCandidates = (): TCandidate[] => {
  const { data } = useAllCandidatesQuery()

  return useMemo(() => {
    if (!data?.data || !Array.isArray(data.data)) {
      return []
    }

    return data.data as TCandidate[]
  }, [data])
}

