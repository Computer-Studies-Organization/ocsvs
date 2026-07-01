import type { PageLoad } from "./$types";
import { electionCache } from "$lib/cache";

export const load: PageLoad = async () => {
  const [elections, state] = await Promise.all([
    electionCache.fetchAll(),
    electionCache.fetchVotingState(),
  ]);

  const electionList = elections ?? [];
  const votingState = state ?? {
    open: null,
    nextDraft: null,
    lastClosed: null,
    myVotes: { electionId: null, votes: [] },
  };

  const activeElection = votingState.open || votingState.lastClosed;
  const filtered = electionList.filter((e) => e.status !== "draft");

  let selectedElectionId = "";
  if (activeElection && filtered.some((e) => e.id === activeElection.id)) {
    selectedElectionId = activeElection.id;
  } else if (filtered.length > 0) {
    selectedElectionId = filtered[0].id;
  }

  return { elections: electionList, selectedElectionId };
};
