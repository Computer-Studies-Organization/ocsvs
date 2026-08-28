import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";
import { getEffectiveElectionStatus } from "$lib/election-lifecycle-client";
import { extractErrorMessage } from "$lib/mutation-feedback-utils";
import type { TElectionTurnout, TResults } from "$lib/types";

export const load: PageLoad = async ({ url, fetch }) => {
  const [elections, state] = await Promise.all([
    appCache.get("elections", {}).fetch(false, { fetch }),
    appCache.get("votingState", {}).fetch(false, { fetch }),
  ]);

  const electionList = elections ?? [];
  const votingState = state ?? {
    open: null,
    nextDraft: null,
    lastClosed: null,
    myVotes: { electionId: null, hasVoted: false },
  };

  const filtered = electionList.filter((e) => getEffectiveElectionStatus(e) !== "draft");

  // Resolve selected election: explicit query param > active > first visible.
  const queryId = url.searchParams.get("electionId");
  let selectedElectionId = "";
  if (queryId && filtered.some((e) => e.id === queryId)) {
    selectedElectionId = queryId;
  } else {
    const activeElection = votingState.open || votingState.lastClosed;
    if (activeElection && filtered.some((e) => e.id === activeElection.id)) {
      selectedElectionId = activeElection.id;
    } else if (filtered.length > 0) {
      selectedElectionId = filtered[0].id;
    }
  }

  let results: TResults = [];
  let turnout: TElectionTurnout | null = null;
  let resultsError = "";
  if (selectedElectionId) {
    try {
      const resultData = await appCache
        .get("results", { electionId: selectedElectionId })
        .fetchOrThrow(true, { fetch });
      results = resultData.results;
      turnout = resultData.turnout;
    } catch (err: unknown) {
      resultsError = extractErrorMessage(err, "Failed to load election results");
    }
  }

  return {
    elections: electionList,
    selectedElectionId,
    results,
    turnout,
    resultsError,
  };
};
