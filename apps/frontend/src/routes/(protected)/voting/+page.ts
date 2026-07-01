import type { PageLoad } from "./$types";
import { electionCache, candidateCache, positionCache } from "$lib/cache";

export const load: PageLoad = async ({ depends }) => {
  depends("app:voting");

  const state = await electionCache.fetchVotingState();

  let candidates = null;
  let positions = null;

  if (state?.open) {
    const [cands, pos] = await Promise.all([
      candidateCache.fetch(state.open.id),
      positionCache.fetch(state.open.id),
    ]);
    candidates = cands;
    positions = pos;
  }

  return { votingState: state, candidates, positions };
};
