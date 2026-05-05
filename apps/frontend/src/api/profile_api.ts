import { api } from './axios'

export interface ProfileData {
  id: string
  username: string
  email: string | null
  role: string
  studentId: string
  firstName: string
  lastName: string
  yearLevel: string
  course: string
}

export interface UpdateProfileData {
  firstName?: string
  lastName?: string
  username?: string
  email?: string
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

export const getMyProfile = async (): Promise<ProfileData> => {
  const response = await api.get('/me/profile')
  return response.data
}

export const updateMyProfile = async (data: UpdateProfileData): Promise<{ message: string; profile: ProfileData }> => {
  const response = await api.patch('/me/profile', data)
  return response.data
}

export const changePassword = async (data: ChangePasswordData): Promise<{ message: string }> => {
  const response = await api.post('/me/password', data)
  return response.data
}
