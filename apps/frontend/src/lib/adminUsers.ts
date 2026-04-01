import type { TUsersData } from "@/@types";

export const resolveCandidateUserSelection = (
  users: TUsersData[],
  accountId: string,
) => {
  return users.find((user) => user.accountId === accountId) ?? null;
};

export const getCandidateUserLabel = (user: Pick<TUsersData, "fullName" | "studentId">) => {
  return `${user.fullName} (${user.studentId})`;
};
