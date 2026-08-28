import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";
import { getEffectiveElectionStatus } from "$lib/election-lifecycle-client";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election-detail");

  const election = await appCache
    .get("election", { id: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 404) error(404, "Election not found");
      throw cause;
    });

  const effectiveStatus = getEffectiveElectionStatus(election);
  const votingState =
    effectiveStatus === "open"
      ? await appCache.get("votingState", {}).fetchOrThrow(true, { fetch })
      : null;
  const effectiveElection =
    effectiveStatus === election.status ? election : { ...election, status: effectiveStatus };

  const hasVoted =
    effectiveElection.status === "open" &&
    votingState?.myVotes.electionId === params.electionId &&
    votingState.myVotes.hasVoted;
  const shouldLoadResults =
    effectiveElection.status === "closed" ||
    effectiveElection.status === "archived" ||
    (effectiveElection.status === "open" && hasVoted);

  let results = null;
  let turnout = null;
  if (shouldLoadResults) {
    const resultData = await appCache
      .get("results", { electionId: params.electionId })
      .fetchOrThrow(
        effectiveElection.status === "closed" || effectiveElection.status === "archived",
        {
          fetch,
        },
      );
    results = resultData.results;
    turnout = resultData.turnout;
  }

  return { election: effectiveElection, results, turnout, hasVoted };
};
