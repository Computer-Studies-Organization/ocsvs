import assert from "node:assert/strict";
import test from "node:test";

import { getCandidateUserLabel, resolveCandidateUserSelection } from "./adminUsers";

const duplicateNameUsers = [
  {
    id: "user-1",
    accountId: "account-1",
    studentId: "C23-00-0001-MAN121",
    fullName: "Alex Cruz",
    firstName: "Alex",
    lastName: "Cruz",
  },
  {
    id: "user-2",
    accountId: "account-2",
    studentId: "C23-00-0002-MAN121",
    fullName: "Alex Cruz",
    firstName: "Alex",
    lastName: "Cruz",
  },
];

test("candidate picker resolves users by accountId instead of display name", () => {
  const selectedUser = resolveCandidateUserSelection(duplicateNameUsers, "account-2");

  assert.equal(selectedUser?.accountId, "account-2");
  assert.equal(selectedUser?.studentId, "C23-00-0002-MAN121");
});

test("candidate picker labels include student id so duplicate names stay distinguishable", () => {
  assert.equal(
    getCandidateUserLabel(duplicateNameUsers[0]),
    "Alex Cruz (C23-00-0001-MAN121)",
  );
});
