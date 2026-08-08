import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ fetch, depends }) => {
  depends("app:voting");

  const votingStateEntry = appCache.get("votingState", { includeBallot: true });
  const state = await votingStateEntry.fetch(false, { fetch });
  const ballot = state?.ballot ?? null;

  let loadError = votingStateEntry.error;

  if (!state) {
    loadError ??= "Failed to load voting state";
  } else if (state.open && !ballot) {
    loadError ??= "Failed to load ballot data";
  }

  return {
    votingState: state,
    candidates: ballot?.candidates ?? null,
    positions: ballot?.positions ?? null,
    partyLists: ballot?.parties ?? [],
    loadError,
  };
};
