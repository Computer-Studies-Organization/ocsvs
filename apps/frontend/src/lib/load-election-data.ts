import { error, type LoadEvent } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";
import { redirectOnUnauthorized } from "$lib/routeGuards";

type ElectionLoadEvent = Pick<LoadEvent, "fetch" | "depends">;

export async function loadElectionData(electionId: string, { fetch, depends }: ElectionLoadEvent) {
  depends("app:election");

  const election = await appCache
    .get("election", { id: electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      if (cause instanceof ApiError && cause.status === 404) {
        error(404, "Election not found");
      }
      throw cause;
    });

  const positions = await appCache
    .get("positions", { electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      throw cause;
    });

  const partyLists = await appCache
    .get("partyLists", { electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      throw cause;
    });

  const candidates = await appCache
    .get("candidates", { electionId, includeInactive: true })
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
}
