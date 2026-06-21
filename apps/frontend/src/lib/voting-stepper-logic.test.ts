import type { TStepperPosition } from "./voting-stepper-logic";
import assert from "node:assert/strict";
import test from "node:test";
import {
  allPositionsVoted,
  createVotingState,
  getSelectedCount,
  getSelectedVotes,
  goNext,
  goPrevious,
  hasCurrentVote,
  isFirstPosition,
  isLastPosition,
  selectCandidate,
} from "./voting-stepper-logic";

const positions: TStepperPosition[] = [
  {
    id: "pos-1",
    name: "President",
    displayOrder: 0,
    candidates: [
      { id: "c1", fullName: "Alice" },
      { id: "c2", fullName: "Bob" },
    ],
  },
  {
    id: "pos-2",
    name: "Vice President",
    displayOrder: 1,
    candidates: [
      { id: "c3", fullName: "Charlie" },
      { id: "c4", fullName: "Dave" },
    ],
  },
  { id: "pos-3", name: "Secretary", displayOrder: 2, candidates: [{ id: "c5", fullName: "Eve" }] },
];

test("createVotingState initializes all positions to null and index to 0", () => {
  const state = createVotingState(positions);
  assert.deepEqual(state.selectedVotes, { "pos-1": null, "pos-2": null, "pos-3": null });
  assert.equal(state.currentPositionIndex, 0);
});

test("selectCandidate sets vote for correct position", () => {
  const state = createVotingState(positions);
  const next = selectCandidate(state, "pos-1", "c1");
  assert.equal(next.selectedVotes["pos-1"], "c1");
  assert.equal(next.selectedVotes["pos-2"], null);
});

test("selectCandidate can change an existing vote", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-1", "c2");
  assert.equal(state.selectedVotes["pos-1"], "c2");
});

test("goNext advances index", () => {
  const state = createVotingState(positions);
  const next = goNext(state, positions.length);
  assert.equal(next.currentPositionIndex, 1);
});

test("goNext does not exceed last index", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 2 };
  const next = goNext(state, 3);
  assert.equal(next.currentPositionIndex, 2);
});

test("goNext does not go below 0 when totalPositions is 0", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 };
  const next = goNext(state, 0);
  assert.equal(next.currentPositionIndex, 0);
});

test("goPrevious decrements index", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 2 };
  const next = goPrevious(state);
  assert.equal(next.currentPositionIndex, 1);
});

test("goPrevious does not go below 0", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 };
  const next = goPrevious(state);
  assert.equal(next.currentPositionIndex, 0);
});

test("isFirstPosition true at 0, false otherwise", () => {
  assert.equal(isFirstPosition({ selectedVotes: {}, currentPositionIndex: 0 }), true);
  assert.equal(isFirstPosition({ selectedVotes: {}, currentPositionIndex: 1 }), false);
});

test("isLastPosition true at last, false otherwise", () => {
  assert.equal(isLastPosition({ selectedVotes: {}, currentPositionIndex: 2 }, 3), true);
  assert.equal(isLastPosition({ selectedVotes: {}, currentPositionIndex: 0 }, 3), false);
});

test("hasCurrentVote false when no vote for current position", () => {
  const state = createVotingState(positions);
  assert.equal(hasCurrentVote(state, positions), false);
});

test("hasCurrentVote true when vote exists for current position", () => {
  const state = selectCandidate(createVotingState(positions), "pos-1", "c1");
  assert.equal(hasCurrentVote(state, positions), true);
});

test("hasCurrentVote false when current index is out of bounds", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 99 };
  assert.equal(hasCurrentVote(state, positions), false);
});

test("allPositionsVoted false when some positions have no vote", () => {
  const state = selectCandidate(createVotingState(positions), "pos-1", "c1");
  assert.equal(allPositionsVoted(state, positions), false);
});

test("allPositionsVoted true when all positions have votes", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-2", "c3");
  state = selectCandidate(state, "pos-3", "c5");
  assert.equal(allPositionsVoted(state, positions), true);
});

test("allPositionsVoted true for empty positions", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 };
  assert.equal(allPositionsVoted(state, []), true);
});

test("getSelectedVotes returns only non-null selections with positionId and candidateId", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-3", "c5");
  assert.deepEqual(getSelectedVotes(state), [
    { positionId: "pos-1", candidateId: "c1" },
    { positionId: "pos-3", candidateId: "c5" },
  ]);
});

test("getSelectedVotes returns empty array when nothing selected", () => {
  const state = createVotingState(positions);
  assert.deepEqual(getSelectedVotes(state), []);
});

test("getSelectedCount counts non-null votes", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-3", "c5");
  assert.equal(getSelectedCount(state), 2);
});

test("getSelectedCount returns 0 when nothing selected", () => {
  const state = createVotingState(positions);
  assert.equal(getSelectedCount(state), 0);
});
