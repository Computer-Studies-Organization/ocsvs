import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election-detail");

  const election = await appCache
    .get("election", { id: params.electionId })
    .fetch(false, { fetch });
  if (!election) error(404, "Election not found");

  let results = null;
  let hasVoted = false;

  if (election.status === "closed" || election.status === "archived") {
    results = await appCache
      .get("results", { electionId: params.electionId })
      .fetch(false, { fetch });
  } else if (election.status === "open") {
    const votingState = await appCache.get("votingState", {}).fetch(true, { fetch });
    hasVoted =
      votingState?.myVotes.electionId === params.electionId && votingState.myVotes.votes.length > 0;
    if (hasVoted) {
      results = await appCache
        .get("results", { electionId: params.electionId })
        .fetch(false, { fetch });
    }
  }

  return { election, results, hasVoted };
};
