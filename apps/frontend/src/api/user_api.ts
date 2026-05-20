import type { TLoginUser, TRegisterUser } from '@/@types'
import { api } from './axios'

export async function registerUser(data: TRegisterUser) {
  const response = await api.post('/register', data)
  return response.data
}

export async function loginUser(data: TLoginUser) {
  const response = await api.post('/login', data)
  return response.data
}

export async function logoutUser() {
  const response = await api.post('/logout')
  return response.data
}

export async function authMe() {
  const response = await api.get('/me', {
    skipUnauthorizedRedirect: true,
  })
  return response.data
}

export async function fetchUsers(page: number = 1, limit: number = 100, search?: string, yearLevel?: string, course?: string, includeDeleted?: boolean) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  })
  if (search)
    params.append('search', search)
  if (yearLevel)
    params.append('yearLevel', yearLevel)
  if (course)
    params.append('course', course)
  if (includeDeleted !== undefined)
    params.append('includeDeleted', includeDeleted.toString())

  const response = await api.get(`/users?${params.toString()}`)
  return response.data
}

export async function fetchUser(userId: string) {
  const response = await api.get(`/users/${userId}`)
  return response.data
}

export async function updateUser(userId: string, data: {
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  yearLevel?: string
  course?: string
}) {
  const response = await api.patch(`/users/${userId}`, data)
  return response.data
}

export async function deleteUser(userId: string) {
  const response = await api.delete(`/users/${userId}`)
  return response.data
}

export async function restoreUser(userId: string) {
  const response = await api.post(`/users/${userId}/restore`)
  return response.data
}
