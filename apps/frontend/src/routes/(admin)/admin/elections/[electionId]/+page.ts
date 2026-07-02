import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ params, depends }) => {
  depends("app:election");

  const election = await appCache.get("election", { id: params.electionId }).fetch();
  if (!election) error(404, "Election not found");

  const positions = await appCache.get("positions", { electionId: params.electionId }).fetch();

  return { election, positions: positions ?? [] };
};
