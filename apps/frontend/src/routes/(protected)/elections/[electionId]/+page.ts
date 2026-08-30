import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";
import { getEffectiveElectionStatus } from "$lib/election-lifecycle-client";
import { redirectOnUnauthorized } from "$lib/routeGuards";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election-detail");

  const election = await appCache
    .get("election", { id: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      if (cause instanceof ApiError) {
        if (cause.status === 404) error(404, "Election not found");
      }
      throw cause;
    });

  const effectiveStatus = getEffectiveElectionStatus(election);
  const votingState =
    effectiveStatus === "open"
      ? await appCache
          .get("votingState", {})
          .fetchOrThrow(true, { fetch })
          .catch((cause: unknown) => {
            redirectOnUnauthorized(cause);
            throw cause;
          })
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
      )
      .catch((cause: unknown) => {
        redirectOnUnauthorized(cause);
        throw cause;
      });
    results = resultData.results;
    turnout = resultData.turnout;
  }

  return { election: effectiveElection, results, turnout, hasVoted };
};
