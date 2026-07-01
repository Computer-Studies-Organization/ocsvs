import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { electionCache, positionCache } from "$lib/cache";

export const load: PageLoad = async ({ params, depends }) => {
  depends("app:election");

  const election = await electionCache.fetch(params.electionId);
  if (!election) error(404, "Election not found");

  const positions = await positionCache.fetch(params.electionId);

  return { election, positions: positions ?? [] };
};
