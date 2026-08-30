import type { PageLoad } from "./$types";
import { getMyProfile } from "$lib/api/profile";
import { redirectOnUnauthorized } from "$lib/routeGuards";

export const load: PageLoad = async ({ depends }) => {
  depends("app:profile");
  try {
    const profile = await getMyProfile();
    return { profile };
  } catch (cause: unknown) {
    redirectOnUnauthorized(cause);
    throw cause;
  }
};
