import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ depends }) => {
  depends("app:voting");

  const state = await appCache.get("votingState", {}).fetch();

  let candidates = null;
  let positions = null;

  if (state?.open) {
    const [cands, pos] = await Promise.all([
      appCache.get("candidates", { electionId: state.open.id }).fetch(),
      appCache.get("positions", { electionId: state.open.id }).fetch(),
    ]);
    candidates = cands;
    positions = pos;
  }

  return { votingState: state, candidates, positions };
};
