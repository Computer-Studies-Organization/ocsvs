import type { PageLoad } from "./$types";
import { electionCache } from "$lib/cache";

export const load: PageLoad = async ({ depends }) => {
  depends("app:elections");
  const elections = await electionCache.fetchAll();
  return { elections: elections ?? [] };
};
