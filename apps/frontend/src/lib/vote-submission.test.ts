import { expect, test, vi } from "vitest";

import type { TVotingState } from "./types";
import { submitVoteWithReconciliation } from "./vote-submission";

const baseState: TVotingState = {
  open: null,
  nextDraft: null,
  lastClosed: null,
  ballot: null,
  myVotes: { electionId: null, hasVoted: false },
};

test("treats an interrupted response as success when participation was recorded", async () => {
  const error = new TypeError("Failed to fetch");
  const refresh = vi.fn().mockResolvedValue({
    ...baseState,
    myVotes: { electionId: "election-1", hasVoted: true },
  });

  await expect(
    submitVoteWithReconciliation("election-1", () => Promise.reject(error), refresh),
  ).resolves.toBeUndefined();
  expect(refresh).toHaveBeenCalledOnce();
});

test("preserves a submission error when participation was not recorded", async () => {
  const error = new TypeError("Failed to fetch");

  await expect(
    submitVoteWithReconciliation(
      "election-1",
      () => Promise.reject(error),
      () => Promise.resolve(baseState),
    ),
  ).rejects.toBe(error);
});

test("refreshes voting state on successful submission", async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const refresh = vi.fn().mockResolvedValue(baseState);

  await expect(
    submitVoteWithReconciliation("election-1", submit, refresh),
  ).resolves.toBeUndefined();

  expect(submit).toHaveBeenCalledOnce();
  expect(refresh).toHaveBeenCalledOnce();
});
