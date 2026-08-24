import type { TLoginUser, TUserData } from "$lib/types";
import { ApiError, apiFetch } from "./client";

export async function login(data: TLoginUser): Promise<TUserData> {
  return apiFetch("/login", {
    method: "POST",
    body: JSON.stringify(data),
    skipAuthStateReset: true,
  });
}

export async function logout(): Promise<{ message: string }> {
  return apiFetch("/logout", { method: "POST", skipAuthStateReset: true });
}

export async function me(): Promise<TUserData | null> {
  try {
    return await apiFetch<TUserData | null>("/me", { skipAuthStateReset: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
