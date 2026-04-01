import assert from "node:assert/strict";
import test from "node:test";

import { getAdminDashboardActiveMessage } from "./adminFeedback";

test("admin dashboard shows the active user message while the user modal is open", () => {
  assert.equal(
    getAdminDashboardActiveMessage({
      candidateMessage: "Candidate saved",
      userMessage: "User saved",
      isCandidateModalOpen: false,
      isUserModalOpen: true,
    }),
    "User saved",
  );
});

test("admin dashboard shows the active candidate message while the candidate modal is open", () => {
  assert.equal(
    getAdminDashboardActiveMessage({
      candidateMessage: "Candidate saved",
      userMessage: "User saved",
      isCandidateModalOpen: true,
      isUserModalOpen: false,
    }),
    "Candidate saved",
  );
});

test("admin dashboard prefers the freshest user message once both modals are closed", () => {
  assert.equal(
    getAdminDashboardActiveMessage({
      candidateMessage: "Old candidate message",
      userMessage: "Fresh user message",
      isCandidateModalOpen: false,
      isUserModalOpen: false,
    }),
    "Fresh user message",
  );
});
