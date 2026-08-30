import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getCandidate } from "$lib/api/candidates";
import { ApiError } from "$lib/api/client";
import { fetchUser } from "$lib/api/users";
import { appCache } from "$lib/cache";
import { redirectOnUnauthorized } from "$lib/routeGuards";
import type { TAdminCandidate } from "$lib/types";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:candidate");
  const { electionId, positionId, candidateId } = params;

  let cand: TAdminCandidate;
  try {
    cand = await getCandidate(candidateId, { fetch });
  } catch (cause: unknown) {
    redirectOnUnauthorized(cause);
    throw cause;
  }

  const [election, positions, user, partyLists] = await Promise.all([
    appCache
      .get("election", { id: electionId })
      .fetchOrThrow(false, { fetch })
      .catch((cause: unknown) => {
        redirectOnUnauthorized(cause);
        if (cause instanceof ApiError) {
          if (cause.status === 404) error(404, "Election not found");
        }
        throw cause;
      }),
    appCache.get("positions", { electionId }).fetchOrThrow(false, { fetch }),
    fetchUser(cand.userId, { fetch }).catch((cause: unknown) => {
      redirectOnUnauthorized(cause);
      return null;
    }),
    appCache.get("partyLists", { electionId }).fetchOrThrow(false, { fetch }),
  ]).catch((cause: unknown) => {
    redirectOnUnauthorized(cause);
    throw cause;
  });

  const position = positions.find((p) => p.id === positionId) ?? null;
  if (!position || cand.positionId !== positionId) {
    error(404, "Candidate not found in this position");
  }

  return { candidate: cand, election, position, user, partyLists };
};
