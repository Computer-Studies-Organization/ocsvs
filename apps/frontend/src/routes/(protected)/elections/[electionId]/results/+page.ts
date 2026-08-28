import type { PageLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";
import { getEffectiveElectionStatus } from "$lib/election-lifecycle-client";

export const load: PageLoad = async ({ params, fetch }) => {
  const election = await appCache
    .get("election", { id: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 404) error(404, "Election not found");
      throw cause;
    });

  const status = getEffectiveElectionStatus(election);
  const resultData = await appCache
    .get("results", { electionId: params.electionId })
    .fetchOrThrow(status === "closed" || status === "archived", { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 403) {
        redirect(302, "/voting");
      }
      if (cause instanceof ApiError && cause.status === 404) {
        error(404, "Election not found");
      }
      throw cause;
    });

  const partyLists = await appCache
    .get("partyLists", { electionId: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch(() => []);

  return {
    election,
    results: resultData.results,
    turnout: resultData.turnout,
    partyLists,
  };
};
