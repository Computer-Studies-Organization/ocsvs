import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getCandidate } from "$lib/api/candidates";
import { fetchUser } from "$lib/api/users";
import { appCache } from "$lib/cache";
import { listPartyLists } from "$lib/api/parties";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:candidate");
  const { electionId, positionId, candidateId } = params;

  const cand = (await getCandidate(candidateId, { fetch })) as unknown as {
    id: string;
    fullName: string;
    accountId: string;
    positionId: string;
    partyId?: string | null;
    manifesto: string;
    isActive: number;
    imageUrl: string | null;
  };

  const [election, positions, user, partyLists] = await Promise.all([
    appCache.get("election", { id: electionId }).fetch(false, { fetch }),
    appCache.get("positions", { electionId }).fetch(false, { fetch }),
    fetchUser(cand.accountId, { fetch }).catch(() => null),
    listPartyLists(electionId, { fetch }).catch(() => []),
  ]);

  if (!election) error(404, "Election not found");

  const position = positions?.find((p) => p.id === positionId) ?? null;

  return { candidate: cand, election, position, user, partyLists };
};
