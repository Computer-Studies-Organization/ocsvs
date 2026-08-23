import type { TUsersData } from "$lib/types";
import { apiFetch, type ApiFetchOptions } from "./client";

export interface UsersResponse {
  data: TUsersData[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function fetchUsers(
  query: {
    page?: number;
    limit?: number;
    search?: string;
    yearLevel?: string;
    course?: string;
    role?: string;
    includeDeleted?: boolean;
  } = {},
  options?: ApiFetchOptions,
): Promise<UsersResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    limit: String(query.limit ?? 100),
  });
  if (query.search) params.append("search", query.search);
  if (query.yearLevel) params.append("yearLevel", query.yearLevel);
  if (query.course) params.append("course", query.course);
  if (query.role) params.append("role", query.role);
  if (query.includeDeleted !== undefined)
    params.append("includeDeleted", String(query.includeDeleted));
  return apiFetch(`/users?${params.toString()}`, options);
}

export async function fetchUser(userId: string, options?: ApiFetchOptions): Promise<TUsersData> {
  return apiFetch(`/users/${userId}`, options);
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

export interface ImportUser {
  studentId: string;
  firstName: string;
  lastName: string;
  course: string;
  yearLevel: string;
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

export const IMPORT_USERS_BATCH_SIZE = 300;

export async function importUsers(data: { users: ImportUser[] }): Promise<ImportUsersResponse> {
  return apiFetch("/users/import", { method: "POST", body: JSON.stringify(data) });
}

export async function importUsersInBatches(
  users: ImportUser[],
  onBatchResult: (result: ImportUsersResponse) => void,
): Promise<void> {
  for (let start = 0; start < users.length; start += IMPORT_USERS_BATCH_SIZE) {
    onBatchResult(
      await importUsers({ users: users.slice(start, start + IMPORT_USERS_BATCH_SIZE) }),
    );
  }
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

export async function createUser(data: {
  firstName: string;
  lastName: string;
  studentId: string;
  course: string;
  yearLevel: string;
  username?: string;
  email?: string;
  password: string;
  role?: string;
}): Promise<{
  message: string;
  user: { id: string; email: string | null; username: string; role: string; studentId: string };
}> {
  return apiFetch("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function unlockUser(userId: string): Promise<{ message: string }> {
  return apiFetch(`/users/${userId}/unlock`, { method: "POST" });
}
