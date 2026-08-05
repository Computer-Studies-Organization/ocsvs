import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ fetch, depends }) => {
  depends("app:voting");

  const votingStateEntry = appCache.get("votingState", {});
  const state = await votingStateEntry.fetch(false, { fetch });

  let candidates = null;
  let positions = null;
  let partyLists = null;
  let loadError = votingStateEntry.error;

  if (!state) {
    loadError ??= "Failed to load voting state";
  } else if (state.open) {
    const candidatesEntry = appCache.get("candidates", { electionId: state.open.id });
    const positionsEntry = appCache.get("positions", { electionId: state.open.id });
    const partyListsEntry = appCache.get("partyLists", { electionId: state.open.id });
    const [cands, pos, parties] = await Promise.all([
      candidatesEntry.fetch(false, { fetch }),
      positionsEntry.fetch(false, { fetch }),
      partyListsEntry.fetch(false, { fetch }),
    ]);
    candidates = cands;
    positions = pos;
    partyLists = parties;
    loadError ??= candidatesEntry.error ?? positionsEntry.error ?? partyListsEntry.error;
    if (!candidates || !positions) {
      loadError ??= "Failed to load ballot data";
    }
  }

  return {
    votingState: state,
    candidates,
    positions,
    partyLists: partyLists ?? [],
    loadError,
  };
};
