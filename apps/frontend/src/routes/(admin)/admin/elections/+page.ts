import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ fetch, depends }) => {
  depends("app:elections");
  const elections = await appCache.get("elections", {}).fetch(false, { fetch });
  return { elections: elections ?? [] };
};
