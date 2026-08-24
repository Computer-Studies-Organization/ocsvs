import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:position");
  const { electionId, positionId } = params;

  const [election, allPos, candidates, partyLists] = await Promise.all([
    appCache
      .get("election", { id: electionId })
      .fetchOrThrow(false, { fetch })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 404) error(404, "Election not found");
        throw cause;
      }),
    appCache.get("positions", { electionId }).fetchOrThrow(false, { fetch }),
    appCache
      .get("candidates", { electionId, positionId, includeInactive: true })
      .fetchOrThrow(false, { fetch }),
    appCache.get("partyLists", { electionId }).fetchOrThrow(false, { fetch }),
  ]);

  const position = allPos.find((p) => p.id === positionId) ?? null;
  const mappedCandidates = candidates.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    isActive: (c as { isActive?: number }).isActive,
  }));

  return { election, position, candidates: mappedCandidates, partyLists };
};
