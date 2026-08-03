import type { TUsersData } from "./types";
import { expect, test, vi } from "vitest";
import {
  getCandidateUserLabel,
  isLatestAuditRequest,
  isOutsideMoreMenu,
  resolveCandidateUserSelection,
} from "./adminUsers";

const baseUser = {
  username: "alex.cruz",
  email: null,
  yearLevel: "3rd Year",
  course: "BSCS",
  role: "user",
  hasVoted: false,
  deletedAt: null,
  createdAt: 1_700_000_000,
  updatedAt: 1_700_000_000,
  lastLogin: null,
} as const;

const duplicateNameUsers: TUsersData[] = [
  {
    id: "user-1",
    accountId: "account-1",
    studentId: "C23-00-0001-MAN121",
    fullName: "Alex Cruz",
    firstName: "Alex",
    lastName: "Cruz",
    ...baseUser,
  },
  {
    id: "user-2",
    accountId: "account-2",
    studentId: "C23-00-0002-MAN121",
    fullName: "Alex Cruz",
    firstName: "Alex",
    lastName: "Cruz",
    ...baseUser,
  },
];

test("candidate picker resolves users by accountId instead of display name", () => {
  const selectedUser = resolveCandidateUserSelection(duplicateNameUsers, "account-2");

  expect(selectedUser?.accountId).toBe("account-2");
  expect(selectedUser?.studentId).toBe("C23-00-0002-MAN121");
});

test("candidate picker labels include student id so duplicate names stay distinguishable", () => {
  expect(getCandidateUserLabel(duplicateNameUsers[0])).toBe("Alex Cruz (C23-00-0001-MAN121)");
});

test("candidate picker label falls back to firstName and lastName if fullName is missing", () => {
  const userWithoutFullName = {
    studentId: "C23-00-0003-MAN121",
    firstName: "Maria",
    lastName: "Santos",
  };
  expect(getCandidateUserLabel(userWithoutFullName)).toBe("Maria Santos (C23-00-0003-MAN121)");
});

test("stale audit responses are rejected", () => {
  expect(isLatestAuditRequest(1, 2)).toBe(false);
  expect(isLatestAuditRequest(2, 2)).toBe(true);
});

test("outside-menu detection ignores clicks inside menu", () => {
  const insideMenu = { closest: vi.fn().mockReturnValue({}) };
  const outsideMenu = { closest: vi.fn().mockReturnValue(null) };

  expect(isOutsideMoreMenu(insideMenu)).toBe(false);
  expect(isOutsideMoreMenu(outsideMenu)).toBe(true);
});
