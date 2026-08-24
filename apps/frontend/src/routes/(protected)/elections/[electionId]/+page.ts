import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";
import type { TElectionStatus } from "$lib/types";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election-detail");

  const election = await appCache
    .get("election", { id: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 404) error(404, "Election not found");
      throw cause;
    });

  const now = Math.floor(Date.now() / 1000);
  const effectiveStatus: TElectionStatus =
    election.status !== "open"
      ? election.status
      : election.opensAt === null || election.closesAt === null
        ? "draft"
        : now < election.opensAt
          ? "draft"
          : now > election.closesAt
            ? "closed"
            : "open";
  const votingState =
    effectiveStatus === "open"
      ? await appCache.get("votingState", {}).fetchOrThrow(true, { fetch })
      : null;
  const effectiveElection =
    effectiveStatus === election.status ? election : { ...election, status: effectiveStatus };

  let results = null;
  let hasVoted = false;

  if (effectiveElection.status === "closed" || effectiveElection.status === "archived") {
    results = await appCache
      .get("results", { electionId: params.electionId })
      .fetchOrThrow(false, { fetch });
  } else if (effectiveElection.status === "open") {
    hasVoted =
      votingState?.myVotes.electionId === params.electionId && votingState.myVotes.hasVoted;
    if (hasVoted) {
      results = await appCache
        .get("results", { electionId: params.electionId })
        .fetchOrThrow(false, { fetch });
    }
  }

  return { election: effectiveElection, results, hasVoted };
};
