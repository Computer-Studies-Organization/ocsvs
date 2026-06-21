import type { getCandidateVoteCount } from "@/api/votes_api";

type VoteCountResponse = Awaited<ReturnType<typeof getCandidateVoteCount>>;

export function mergeVoteCounts(
  candidateIds: string[],
  queryResults: Array<{ data: VoteCountResponse | undefined; isLoading: boolean }>,
): { voteCounts: Record<string, number>; isLoading: boolean } {
  const isLoading = queryResults.some((q) => q.isLoading);
  const counts: Record<string, number> = {};
  if (process.env.NODE_ENV !== "production") {
    console.assert(
      candidateIds.length === queryResults.length,
      "mergeVoteCounts: candidateIds and queryResults must have the same length",
    );
  }

  candidateIds.forEach((id, index) => {
    const data = queryResults[index]?.data;
    if (data != null) {
      counts[id] = data.voteCount;
    }
  });

  return { voteCounts: counts, isLoading };
}
