import assert from "node:assert/strict";
import test from "node:test";
import { hasVotedIn, pickEmptyCardVariant } from "./voting-page-state";
import type { TVotingState } from "./types";

const base: TVotingState = {
  open: null,
  nextDraft: null,
  lastClosed: null,
  myVotes: { electionId: null, votes: [] },
};

test("pickEmptyCardVariant returns 'next-draft' when only nextDraft is present", () => {
  const state: TVotingState = {
    ...base,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
  };
  assert.equal(pickEmptyCardVariant(state), "next-draft");
});

test("pickEmptyCardVariant returns 'last-closed' when only lastClosed is present", () => {
  const state: TVotingState = {
    ...base,
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
  };
  assert.equal(pickEmptyCardVariant(state), "last-closed");
});

test("pickEmptyCardVariant returns 'both' when nextDraft and lastClosed are both present", () => {
  const state: TVotingState = {
    ...base,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
  };
  assert.equal(pickEmptyCardVariant(state), "both");
});

test("pickEmptyCardVariant returns 'none' when neither nextDraft nor lastClosed is present", () => {
  assert.equal(pickEmptyCardVariant(base), "none");
});

test("hasVotedIn returns true when myVotes match the open election and have at least one vote", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: "e1", votes: [{ candidateId: "c1", positionId: "p1" }] },
  };
  assert.equal(hasVotedIn(state, "e1"), true);
});

test("hasVotedIn returns false when myVotes are for a different election", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: "e0", votes: [{ candidateId: "c1", positionId: "p1" }] },
  };
  assert.equal(hasVotedIn(state, "e1"), false);
});

test("hasVotedIn returns false when there are no votes", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: null, votes: [] },
  };
  assert.equal(hasVotedIn(state, "e1"), false);
});

test("hasVotedIn returns false when electionId is null", () => {
  const state: TVotingState = {
    ...base,
    open: {
      id: "e1",
      name: "X",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    },
    myVotes: { electionId: "e1", votes: [] },
  };
  assert.equal(hasVotedIn(state, "e1"), false);
});
