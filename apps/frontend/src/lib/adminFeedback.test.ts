import assert from "node:assert/strict";
import test from "node:test";

import { getAdminDashboardActiveFeedback } from "./adminFeedback";

test("admin dashboard shows the active user message while the user modal is open", () => {
  assert.equal(
    getAdminDashboardActiveFeedback({
      candidateMessage: { message: "Candidate saved", isSuccess: true },
      userMessage: { message: "User saved", isSuccess: true },
      isCandidateModalOpen: false,
      isUserModalOpen: true,
    })?.message,
    "User saved",
  );
});

test("admin dashboard shows the active candidate message while the candidate modal is open", () => {
  assert.equal(
    getAdminDashboardActiveFeedback({
      candidateMessage: { message: "Candidate saved", isSuccess: true },
      userMessage: { message: "User saved", isSuccess: true },
      isCandidateModalOpen: true,
      isUserModalOpen: false,
    })?.message,
    "Candidate saved",
  );
});

test("admin dashboard prefers the freshest user message once both modals are closed", () => {
  assert.equal(
    getAdminDashboardActiveFeedback({
      candidateMessage: { message: "Old candidate message", isSuccess: false },
      userMessage: { message: "Fresh user message", isSuccess: true },
      isCandidateModalOpen: false,
      isUserModalOpen: false,
    })?.message,
    "Fresh user message",
  );
});

test("admin dashboard returns null when both messages are empty", () => {
  assert.equal(
    getAdminDashboardActiveFeedback({
      candidateMessage: null,
      userMessage: null,
      isCandidateModalOpen: false,
      isUserModalOpen: false,
    }),
    null,
  );
});
