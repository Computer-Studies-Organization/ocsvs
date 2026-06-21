import type { TUserData } from "$lib/types";
import { writable } from "svelte/store";

interface AuthState {
  user: TUserData | null;
  loading: boolean;
}

export const authStore = writable<AuthState>({ user: null, loading: true });
