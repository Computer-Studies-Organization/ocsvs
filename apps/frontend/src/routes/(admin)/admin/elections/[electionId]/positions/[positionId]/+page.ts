import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { appCache } from "$lib/cache";
import { listPartyLists } from "$lib/api/parties";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:position");
  const { electionId, positionId } = params;

  const [election, allPos, candidates, partyLists] = await Promise.all([
    appCache.get("election", { id: electionId }).fetch(false, { fetch }),
    appCache.get("positions", { electionId }).fetch(false, { fetch }),
    appCache
      .get("candidates", { electionId, positionId, includeInactive: true })
      .fetch(false, { fetch }),
    listPartyLists(electionId, { fetch }),
  ]);

  if (!election) error(404, "Election not found");

  const position = allPos?.find((p) => p.id === positionId) ?? null;
  const mappedCandidates = (candidates ?? []).map((c) => ({
    id: c.id,
    fullName: c.fullName,
    isActive: (c as { isActive?: number }).isActive,
  }));

  return { election, position, candidates: mappedCandidates, partyLists };
};
