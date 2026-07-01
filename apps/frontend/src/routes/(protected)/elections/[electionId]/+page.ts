import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { electionCache, resultCache } from "$lib/cache";

export const load: PageLoad = async ({ params, depends }) => {
  depends("app:election-detail");

  const election = await electionCache.fetch(params.electionId);
  if (!election) error(404, "Election not found");

  let results = null;
  let hasVoted = false;

  if (election.status === "closed" || election.status === "archived") {
    results = await resultCache.fetch(params.electionId);
  } else if (election.status === "open") {
    const votingState = await electionCache.fetchVotingState(true);
    hasVoted =
      votingState?.myVotes.electionId === params.electionId && votingState.myVotes.votes.length > 0;
    if (hasVoted) {
      results = await resultCache.fetch(params.electionId);
    }
  }

  return { election, results, hasVoted };
};
