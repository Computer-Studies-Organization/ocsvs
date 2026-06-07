import type { TLoginUser, TRegisterUser, TUserData } from '$lib/types'
import { apiFetch } from './client'

export async function register(data: TRegisterUser): Promise<{ message: string }> {
  return apiFetch('/register', { method: 'POST', body: JSON.stringify(data) })
}

export async function login(data: TLoginUser): Promise<TUserData> {
  return apiFetch('/login', { method: 'POST', body: JSON.stringify(data) })
}

export async function logout(): Promise<{ message: string }> {
  return apiFetch('/logout', { method: 'POST' })
}

export async function me(): Promise<TUserData | null> {
  return apiFetch<TUserData | null>('/me').catch(() => null)
}
