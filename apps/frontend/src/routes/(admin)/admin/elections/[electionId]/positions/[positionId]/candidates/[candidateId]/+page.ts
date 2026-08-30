import type { PageLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { getCandidate } from "$lib/api/candidates";
import { ApiError } from "$lib/api/client";
import { fetchUser } from "$lib/api/users";
import { appCache } from "$lib/cache";
import type { TAdminCandidate } from "$lib/types";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:candidate");
  const { electionId, positionId, candidateId } = params;

  let cand: TAdminCandidate;
  try {
    cand = await getCandidate(candidateId, { fetch });
  } catch (cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      redirect(302, "/auth");
    }
    throw cause;
  }

  const [election, positions, user, partyLists] = await Promise.all([
    appCache
      .get("election", { id: electionId })
      .fetchOrThrow(false, { fetch })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError) {
          if (cause.status === 401) redirect(302, "/auth");
          if (cause.status === 404) error(404, "Election not found");
        }
        throw cause;
      }),
    appCache.get("positions", { electionId }).fetchOrThrow(false, { fetch }),
    fetchUser(cand.userId, { fetch }).catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        redirect(302, "/auth");
      }
      return null;
    }),
    appCache.get("partyLists", { electionId }).fetchOrThrow(false, { fetch }),
  ]).catch((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      redirect(302, "/auth");
    }
    throw cause;
  });

  const position = positions.find((p) => p.id === positionId) ?? null;
  if (!position || cand.positionId !== positionId) {
    error(404, "Candidate not found in this position");
  }

  return { candidate: cand, election, position, user, partyLists };
};
