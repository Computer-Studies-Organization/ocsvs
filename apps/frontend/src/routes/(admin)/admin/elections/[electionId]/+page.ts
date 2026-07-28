import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { appCache } from "$lib/cache";
import { listPartyLists } from "$lib/api/parties";

export const load: PageLoad = async ({ params, fetch, depends }) => {
  depends("app:election");

  const election = await appCache
    .get("election", { id: params.electionId })
    .fetch(false, { fetch });
  if (!election) error(404, "Election not found");

  const positions = await appCache
    .get("positions", { electionId: params.electionId })
    .fetch(false, { fetch });

  const partyLists = await listPartyLists(params.electionId, { fetch }).catch(() => []);

  return { election, positions: positions ?? [], partyLists: partyLists ?? [] };
};
