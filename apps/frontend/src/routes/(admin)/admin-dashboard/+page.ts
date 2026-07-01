import type { PageLoad } from "./$types";
import { userCache } from "$lib/cache";

export const load: PageLoad = async ({ url, depends }) => {
  depends("app:users");
  // Seeds the "Show archived" checkbox on first paint. The user cache always
  // returns active + archived users, so this flag does not filter the fetch —
  // the +page.svelte derives the visible list from `data.users` client-side.
  const includeDeleted = url.searchParams.get("archived") === "true";
  const users = await userCache.fetch();
  return { users: users ?? [], includeDeleted };
};
