import { api } from "./axios";

export interface ProfileData {
  id: string;
  username: string;
  email: string | null;
  role: string;
  studentId: string;
  firstName: string;
  lastName: string;
  yearLevel: string;
  course: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export async function getMyProfile(): Promise<ProfileData> {
  const response = await api.get("/me/profile");
  return response.data;
}

export async function updateMyProfile(
  data: UpdateProfileData,
): Promise<{ message: string; profile: ProfileData }> {
  const response = await api.patch("/me/profile", data);
  return response.data;
}

export async function changePassword(data: ChangePasswordData): Promise<{ message: string }> {
  const response = await api.post("/me/password", data);
  return response.data;
}
