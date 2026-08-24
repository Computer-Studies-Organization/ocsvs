import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getCandidate } from "$lib/api/candidates";
import { ApiError } from "$lib/api/client";
import { fetchUser } from "$lib/api/users";
import { appCache } from "$lib/cache";
import type { TAdminCandidate } from "$lib/types";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:candidate");
  const { electionId, positionId, candidateId } = params;

  const cand: TAdminCandidate = await getCandidate(candidateId, { fetch });

  const [election, positions, user, partyLists] = await Promise.all([
    appCache
      .get("election", { id: electionId })
      .fetchOrThrow(false, { fetch })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 404) error(404, "Election not found");
        throw cause;
      }),
    appCache.get("positions", { electionId }).fetchOrThrow(false, { fetch }),
    fetchUser(cand.userId, { fetch }).catch(() => null),
    appCache.get("partyLists", { electionId }).fetchOrThrow(false, { fetch }),
  ]);

  const position = positions.find((p) => p.id === positionId) ?? null;
  if (!position || cand.positionId !== positionId) {
    error(404, "Candidate not found in this position");
  }

  return { candidate: cand, election, position, user, partyLists };
};
