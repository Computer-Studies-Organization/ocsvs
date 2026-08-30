import type { PageLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { getMyProfile } from "$lib/api/profile";

export const load: PageLoad = async ({ depends }) => {
  depends("app:profile");
  try {
    const profile = await getMyProfile();
    return { profile };
  } catch (cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      redirect(302, "/auth");
    }
    throw cause;
  }
};
