import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";
import { listResults } from "$lib/api/elections";
import { extractErrorMessage } from "$lib/mutation-feedback-utils";
import type { TVoteResultsResponse } from "$lib/types";

export const load: PageLoad = async ({ url }) => {
  const [elections, state] = await Promise.all([
    appCache.get("elections", {}).fetch(),
    appCache.get("votingState", {}).fetch(),
  ]);

  const electionList = elections ?? [];
  const votingState = state ?? {
    open: null,
    nextDraft: null,
    lastClosed: null,
    myVotes: { electionId: null, votes: [] },
  };

  const filtered = electionList.filter((e) => e.status !== "draft");

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

  let resultsData: TVoteResultsResponse = {
    results: [],
    meta: { totalVotes: 0, totalPositions: 0 },
  };
  let resultsError = "";
  if (selectedElectionId) {
    try {
      const results = await listResults(selectedElectionId);
      resultsData = {
        results: results.map((r) => ({
          positionId: r.positionId,
          positionName: r.positionName,
          candidates: r.candidates.map((c) => ({
            candidateId: c.candidateId,
            candidateName: c.fullName,
            positionId: r.positionId,
            positionName: r.positionName,
            voteCount: c.voteCount,
          })),
        })),
        meta: {
          totalVotes: results.reduce((sum, r) => sum + r.totalVotes, 0),
          totalPositions: results.length,
        },
      };
    } catch (err: unknown) {
      resultsError = extractErrorMessage(err, "Failed to load election results");
    }
  }

  return { elections: electionList, selectedElectionId, resultsData, resultsError };
};
