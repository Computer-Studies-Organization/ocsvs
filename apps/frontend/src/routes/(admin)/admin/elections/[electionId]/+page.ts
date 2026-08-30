import type { PageLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election");

  const election = await appCache
    .get("election", { id: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError) {
        if (cause.status === 401) redirect(302, "/auth");
        if (cause.status === 404) error(404, "Election not found");
      }
      throw cause;
    });

  const positions = await appCache
    .get("positions", { electionId: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        redirect(302, "/auth");
      }
      throw cause;
    });

  const partyLists = await appCache
    .get("partyLists", { electionId: params.electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        redirect(302, "/auth");
      }
      throw cause;
    });

  const candidates = await appCache
    .get("candidates", { electionId: params.electionId, includeInactive: true })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        redirect(302, "/auth");
      }
      throw cause;
    });

  return {
    election,
    positions,
    partyLists,
    candidates,
  };
};
