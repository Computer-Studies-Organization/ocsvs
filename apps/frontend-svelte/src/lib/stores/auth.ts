import { writable } from 'svelte/store'
import type { TUserData } from '$lib/types'

interface AuthState {
  user: TUserData | null
  loading: boolean
}

export const authStore = writable<AuthState>({ user: null, loading: true })
