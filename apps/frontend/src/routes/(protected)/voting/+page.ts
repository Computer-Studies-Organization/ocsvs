import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";
import { listPartyLists } from "$lib/api/parties";

export const load: PageLoad = async ({ fetch, depends }) => {
  depends("app:voting");

  const state = await appCache.get("votingState", {}).fetch(false, { fetch });

  let candidates = null;
  let positions = null;
  let partyLists = null;

  if (state?.open) {
    const [cands, pos, parties] = await Promise.all([
      appCache.get("candidates", { electionId: state.open.id }).fetch(false, { fetch }),
      appCache.get("positions", { electionId: state.open.id }).fetch(false, { fetch }),
      listPartyLists(state.open.id, { fetch }).catch(() => []),
    ]);
    candidates = cands;
    positions = pos;
    partyLists = parties;
  }

  return { votingState: state, candidates, positions, partyLists: partyLists ?? [] };
};
