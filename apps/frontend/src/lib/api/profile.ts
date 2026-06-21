import type { ChangePasswordData, ProfileData, UpdateProfileData } from "$lib/types";
import { apiFetch } from "./client";

export async function getMyProfile(): Promise<ProfileData> {
  return apiFetch("/me/profile");
}

export async function updateMyProfile(
  data: UpdateProfileData,
): Promise<{ message: string; profile: ProfileData }> {
  return apiFetch("/me/profile", { method: "PATCH", body: JSON.stringify(data) });
}

export async function changePassword(data: ChangePasswordData): Promise<{ message: string }> {
  return apiFetch("/me/password", { method: "POST", body: JSON.stringify(data) });
}
