import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";
import { redirectOnUnauthorized } from "$lib/routeGuards";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election");

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

  const positions = await appCache
    .get("positions", { electionId: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      throw cause;
    });

  const partyLists = await appCache
    .get("partyLists", { electionId: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      throw cause;
    });

  const candidates = await appCache
    .get("candidates", { electionId: params.electionId, includeInactive: true })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      throw cause;
    });

  return {
    election,
    positions,
    partyLists,
    candidates,
  };
};
