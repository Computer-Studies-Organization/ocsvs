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

import { buildStepperPositions, deriveVotingPageState } from "./voting-page-state";
import type { TCandidate, TElection, TPosition } from "./types";

const emptyInput = {
  apiState: null,
  positions: null,
  candidates: null,
  loadError: null,
  isAdmin: false,
};

const openElection: TElection = {
  id: "e1",
  name: "Spring",
  description: null,
  status: "open",
  opensAt: 1,
  closesAt: 2,
  createdAt: 1,
  updatedAt: 1,
};

const apiStateWithOpen: TVotingState = {
  open: openElection,
  nextDraft: null,
  lastClosed: null,
  myVotes: { electionId: null, votes: [] },
};

const apiStateVoted: TVotingState = {
  ...apiStateWithOpen,
  myVotes: { electionId: "e1", votes: [{ candidateId: "c1", positionId: "p1" }] },
};

const samplePositions: TPosition[] = [
  { id: "p2", electionId: "e1", name: "Vice", displayOrder: 2, createdAt: 1, updatedAt: 1 },
  { id: "p1", electionId: "e1", name: "President", displayOrder: 1, createdAt: 1, updatedAt: 1 },
];

const sampleCandidates: TCandidate[] = [
  { id: "c1", fullName: "Alice", accountId: "a1", positionId: "p1", manifesto: "", isActive: 1 },
  { id: "c2", fullName: "Bob", accountId: "a2", positionId: "p2", manifesto: "", isActive: 1 },
  { id: "c3", fullName: "Carol", accountId: "a3", positionId: "p1", manifesto: "", isActive: 1 },
];

test("deriveVotingPageState returns loading when apiState is null and no error", () => {
  assert.deepEqual(deriveVotingPageState(emptyInput), { kind: "loading" });
});

test("deriveVotingPageState returns error when loadError is set, even if apiState is also set", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    loadError: "boom",
  });
  assert.deepEqual(result, { kind: "error", message: "boom" });
});

test("deriveVotingPageState returns empty/next-draft when only nextDraft is present", () => {
  const apiState: TVotingState = {
    open: null,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
    lastClosed: null,
    myVotes: { electionId: null, votes: [] },
  };
  const result = deriveVotingPageState({ ...emptyInput, apiState });
  assert.equal(result.kind, "empty");
  if (result.kind !== "empty") throw new Error("narrow");
  assert.equal(result.variant, "next-draft");
  assert.equal(result.nextDraft?.name, "Fall");
  assert.equal(result.lastClosed, null);
  assert.equal(result.isAdmin, false);
});

test("deriveVotingPageState returns empty/last-closed when only lastClosed is present", () => {
  const apiState: TVotingState = {
    open: null,
    nextDraft: null,
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
    myVotes: { electionId: null, votes: [] },
  };
  const result = deriveVotingPageState({ ...emptyInput, apiState });
  assert.equal(result.kind, "empty");
  if (result.kind !== "empty") throw new Error("narrow");
  assert.equal(result.variant, "last-closed");
});

test("deriveVotingPageState returns empty/both when nextDraft and lastClosed are both present", () => {
  const apiState: TVotingState = {
    open: null,
    nextDraft: { id: "d1", name: "Fall", opensAt: 1, closesAt: 2 },
    lastClosed: { id: "c1", name: "Spring", closesAt: 1, results: [] },
    myVotes: { electionId: null, votes: [] },
  };
  const result = deriveVotingPageState({ ...emptyInput, apiState });
  assert.equal(result.kind, "empty");
  if (result.kind !== "empty") throw new Error("narrow");
  assert.equal(result.variant, "both");
});

test("deriveVotingPageState returns empty/none when neither is present", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: { ...apiStateWithOpen, open: null },
  });
  assert.equal(result.kind, "empty");
  if (result.kind !== "empty") throw new Error("narrow");
  assert.equal(result.variant, "none");
});

test("deriveVotingPageState propagates isAdmin on the empty variant", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    isAdmin: true,
    apiState: { ...apiStateWithOpen, open: null },
  });
  assert.equal(result.kind, "empty");
  if (result.kind !== "empty") throw new Error("narrow");
  assert.equal(result.isAdmin, true);
});

test("deriveVotingPageState returns voted when apiState.open is set and myVotes match", () => {
  const result = deriveVotingPageState({ ...emptyInput, apiState: apiStateVoted });
  assert.deepEqual(result, { kind: "voted", election: openElection });
});

test("deriveVotingPageState returns stepper when apiState.open is set and user has not voted", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: sampleCandidates,
  });
  assert.equal(result.kind, "stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  assert.equal(result.election, openElection);
});

test("deriveVotingPageState stepper positions are sorted by displayOrder, candidates filtered by positionId, empty positions removed", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: sampleCandidates,
  });
  assert.equal(result.kind, "stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  assert.equal(result.positions.length, 2);
  assert.equal(result.positions[0]?.id, "p1");
  assert.equal(result.positions[1]?.id, "p2");
  assert.equal(result.positions[0]?.candidates.length, 2);
  assert.equal(result.positions[1]?.candidates.length, 1);
  assert.deepEqual(
    result.positions[0]?.candidates.map((c) => c.id),
    ["c1", "c3"],
  );
});

test("deriveVotingPageState stepper voting is initialised from createVotingState(positions)", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: sampleCandidates,
  });
  assert.equal(result.kind, "stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  assert.equal(result.voting.currentPositionIndex, 0);
  assert.equal(result.voting.selectedVotes["p1"], null);
  assert.equal(result.voting.selectedVotes["p2"], null);
});

test("deriveVotingPageState stepper positions are empty when positions or candidates are null", () => {
  const result = deriveVotingPageState({
    ...emptyInput,
    apiState: apiStateWithOpen,
    positions: samplePositions,
    candidates: null,
  });
  assert.equal(result.kind, "stepper");
  if (result.kind !== "stepper") throw new Error("narrow");
  assert.equal(result.positions.length, 0);
});

test("buildStepperPositions filters out positions with no candidates", () => {
  const positions: TPosition[] = [
    { id: "p1", electionId: "e1", name: "President", displayOrder: 1, createdAt: 1, updatedAt: 1 },
    {
      id: "p2",
      electionId: "e1",
      name: "Vice (empty)",
      displayOrder: 2,
      createdAt: 1,
      updatedAt: 1,
    },
  ];
  const result = buildStepperPositions(positions, [
    { id: "c1", fullName: "Alice", accountId: "a1", positionId: "p1", manifesto: "", isActive: 1 },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, "p1");
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
