import type { PageLoad } from "./$types";
import { userCache } from "$lib/cache";

export const load: PageLoad = async ({ url, depends }) => {
  depends("app:users");
  const includeDeleted = url.searchParams.get("archived") === "true";
  const users = await userCache.fetch();
  return { users: users ?? [], includeDeleted };
};
