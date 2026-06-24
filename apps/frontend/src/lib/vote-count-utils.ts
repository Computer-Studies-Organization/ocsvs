export interface VoteCountResult {
  voteCount: number;
  candidateId: string;
  candidateName: string;
  position: string;
}

export function mergeVoteCounts(
  candidateIds: string[],
  results: Array<{ data: VoteCountResult | undefined; isLoading: boolean }>,
): { voteCounts: Record<string, number>; isLoading: boolean } {
  const isLoading = results.some((q) => q.isLoading);
  const counts: Record<string, number> = {};

  candidateIds.forEach((id, index) => {
    const data = results[index]?.data;
    if (data != null) {
      counts[id] = data.voteCount;
    }
  });

  return { voteCounts: counts, isLoading };
}
