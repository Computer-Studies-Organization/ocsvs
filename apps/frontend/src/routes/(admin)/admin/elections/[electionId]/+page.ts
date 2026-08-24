import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election");

  const election = await appCache
    .get("election", { id: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 404) error(404, "Election not found");
      throw cause;
    });

  const positions = await appCache
    .get("positions", { electionId: params.electionId })
    .fetchOrThrow(false, { fetch });

  const partyLists = await appCache
    .get("partyLists", { electionId: params.electionId })
    .fetchOrThrow(false, { fetch });

  const candidates = await appCache
    .get("candidates", { electionId: params.electionId, includeInactive: true })
    .fetchOrThrow(false, { fetch });

  return {
    election,
    positions,
    partyLists,
    candidates,
  };
};
