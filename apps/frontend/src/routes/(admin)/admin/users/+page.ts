import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ url, depends }) => {
  depends("app:users");
  const includeDeleted = url.searchParams.get("archived") === "true";
  const users = await appCache.get("users", { limit: 100, includeDeleted: true }).fetch();
  return { users: users ?? [], includeDeleted };
};
