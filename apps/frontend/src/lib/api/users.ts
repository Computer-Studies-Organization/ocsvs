import type { TUsersData } from "$lib/types";
import { apiFetch } from "./client";

export interface UsersResponse {
  data: TUsersData[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function fetchUsers(
  options: {
    page?: number;
    limit?: number;
    search?: string;
    yearLevel?: string;
    course?: string;
    includeDeleted?: boolean;
  } = {},
): Promise<UsersResponse> {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 100),
  });
  if (options.search) params.append("search", options.search);
  if (options.yearLevel) params.append("yearLevel", options.yearLevel);
  if (options.course) params.append("course", options.course);
  if (options.includeDeleted !== undefined)
    params.append("includeDeleted", String(options.includeDeleted));
  return apiFetch(`/users?${params.toString()}`);
}

export async function fetchUser(userId: string): Promise<TUsersData> {
  return apiFetch(`/users/${userId}`);
}

export async function updateUser(
  userId: string,
  data: {
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    yearLevel?: string;
    course?: string;
  },
): Promise<TUsersData> {
  return apiFetch(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function deleteUser(userId: string): Promise<{ message: string }> {
  return apiFetch(`/users/${userId}`, { method: "DELETE" });
}

export async function restoreUser(userId: string): Promise<{ message: string }> {
  return apiFetch(`/users/${userId}/restore`, { method: "POST" });
}

export interface ImportedUser {
  studentId: string;
  fullName: string;
  username: string;
  password: string;
}

export interface SkippedUser {
  studentId: string;
  reason: string;
}

export interface ImportUsersResponse {
  message: string;
  imported: ImportedUser[];
  skipped: SkippedUser[];
}

export async function importUsers(data: {
  users: {
    studentId: string;
    firstName: string;
    lastName: string;
    course: string;
    yearLevel: string;
  }[];
}): Promise<ImportUsersResponse> {
  return apiFetch("/users/import", { method: "POST", body: JSON.stringify(data) });
}

export async function hardDeleteUser(
  userId: string,
  confirm: string,
): Promise<{ message: string }> {
  return apiFetch(`/users/${userId}/hard-delete`, {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}
