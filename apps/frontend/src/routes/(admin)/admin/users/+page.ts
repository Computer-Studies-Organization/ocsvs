import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ url, fetch, depends }) => {
  depends("app:users");
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1);
  const search = url.searchParams.get("search") ?? "";
  const course = url.searchParams.get("course") ?? "";
  const yearLevel = url.searchParams.get("yearLevel") ?? "";
  const role = url.searchParams.get("role") ?? "";
  const includeDeleted = url.searchParams.get("archived") === "true";

  const usersResponse = await appCache
    .get("users", {
      page,
      limit: 25,
      search: search || undefined,
      course: course || undefined,
      yearLevel: yearLevel || undefined,
      role: role || undefined,
      includeDeleted,
    })
    .fetch(false, { fetch });

  return {
    usersResponse: usersResponse ?? {
      data: [],
      meta: { total: 0, page: 1, limit: 25, totalPages: 1 },
    },
    page,
    search,
    course,
    yearLevel,
    role,
    includeDeleted,
  };
};
