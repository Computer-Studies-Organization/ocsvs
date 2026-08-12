import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getCandidate } from "$lib/api/candidates";
import { fetchUser } from "$lib/api/users";
import { appCache } from "$lib/cache";
import type { TAdminCandidate } from "$lib/types";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:candidate");
  const { electionId, positionId, candidateId } = params;

  const cand: TAdminCandidate = await getCandidate(candidateId, { fetch });

  const [election, positions, user, partyLists] = await Promise.all([
    appCache.get("election", { id: electionId }).fetch(false, { fetch }),
    appCache.get("positions", { electionId }).fetch(false, { fetch }),
    fetchUser(cand.userId, { fetch }).catch(() => null),
    appCache.get("partyLists", { electionId }).fetch(false, { fetch }),
  ]);

  if (!election) error(404, "Election not found");

  const position = positions?.find((p) => p.id === positionId) ?? null;
  if (!position || cand.positionId !== positionId) {
    error(404, "Candidate not found in this position");
  }

  return { candidate: cand, election, position, user, partyLists };
};
