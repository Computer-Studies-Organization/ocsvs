import type { PageLoad } from "./$types";
import { getMyProfile } from "$lib/api/profile";

export const load: PageLoad = async ({ depends }) => {
  depends("app:profile");
  const profile = await getMyProfile();
  return { profile };
};
