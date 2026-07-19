import type { TUsersData } from "$lib/types";

export function resolveCandidateUserSelection(users: TUsersData[], accountId: string) {
  return users.find((user) => user.accountId === accountId) ?? null;
}

export function getCandidateUserLabel(
  user: Pick<TUsersData, "studentId"> &
    Partial<Pick<TUsersData, "fullName" | "firstName" | "lastName">>,
) {
  const name =
    user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Unknown";
  return `${name} (${user.studentId})`;
}
