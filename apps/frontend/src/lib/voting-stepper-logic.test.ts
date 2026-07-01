import type { TStepperPosition } from "./voting-stepper-logic";
import { expect, test } from "vitest";
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
  isReviewStep,
  selectCandidate,
} from "./voting-stepper-logic";

const positions: TStepperPosition[] = [
  {
    id: "pos-1",
    name: "President",
    displayOrder: 0,
    candidates: [
      { id: "c1", fullName: "Alice", imageUrl: null },
      { id: "c2", fullName: "Bob", imageUrl: null },
    ],
  },
  {
    id: "pos-2",
    name: "Vice President",
    displayOrder: 1,
    candidates: [
      { id: "c3", fullName: "Charlie", imageUrl: null },
      { id: "c4", fullName: "Dave", imageUrl: null },
    ],
  },
  {
    id: "pos-3",
    name: "Secretary",
    displayOrder: 2,
    candidates: [{ id: "c5", fullName: "Eve", imageUrl: null }],
  },
];

test("createVotingState initializes all positions to null and index to 0", () => {
  const state = createVotingState(positions);
  expect(state.selectedVotes).toEqual({ "pos-1": null, "pos-2": null, "pos-3": null });
  expect(state.currentPositionIndex).toBe(0);
});

test("selectCandidate sets vote for correct position", () => {
  const state = createVotingState(positions);
  const next = selectCandidate(state, "pos-1", "c1");
  expect(next.selectedVotes["pos-1"]).toBe("c1");
  expect(next.selectedVotes["pos-2"]).toBeNull();
});

test("selectCandidate can change an existing vote", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-1", "c2");
  expect(state.selectedVotes["pos-1"]).toBe("c2");
});

test("goNext advances index", () => {
  const state = createVotingState(positions);
  const next = goNext(state, positions.length);
  expect(next.currentPositionIndex).toBe(1);
});

test("goNext allows reaching review step index but not exceeding it", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 2 };
  let next = goNext(state, 3);
  expect(next.currentPositionIndex).toBe(3);
  next = goNext(next, 3);
  expect(next.currentPositionIndex).toBe(3);
});

test("goNext does not go below 0 when totalPositions is 0", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 };
  const next = goNext(state, 0);
  expect(next.currentPositionIndex).toBe(0);
});

test("goPrevious decrements index", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 2 };
  const next = goPrevious(state);
  expect(next.currentPositionIndex).toBe(1);
});

test("goPrevious does not go below 0", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 };
  const next = goPrevious(state);
  expect(next.currentPositionIndex).toBe(0);
});

test("isFirstPosition true at 0, false otherwise", () => {
  expect(isFirstPosition({ selectedVotes: {}, currentPositionIndex: 0 })).toBe(true);
  expect(isFirstPosition({ selectedVotes: {}, currentPositionIndex: 1 })).toBe(false);
});

test("isLastPosition true at last, false otherwise", () => {
  expect(isLastPosition({ selectedVotes: {}, currentPositionIndex: 2 }, 3)).toBe(true);
  expect(isLastPosition({ selectedVotes: {}, currentPositionIndex: 0 }, 3)).toBe(false);
});

test("isReviewStep true at totalPositions, false otherwise", () => {
  expect(isReviewStep({ selectedVotes: {}, currentPositionIndex: 3 }, 3)).toBe(true);
  expect(isReviewStep({ selectedVotes: {}, currentPositionIndex: 2 }, 3)).toBe(false);
  expect(isReviewStep({ selectedVotes: {}, currentPositionIndex: 0 }, 3)).toBe(false);
});

test("hasCurrentVote false when no vote for current position", () => {
  const state = createVotingState(positions);
  expect(hasCurrentVote(state, positions)).toBe(false);
});

test("hasCurrentVote true when vote exists for current position", () => {
  const state = selectCandidate(createVotingState(positions), "pos-1", "c1");
  expect(hasCurrentVote(state, positions)).toBe(true);
});

test("hasCurrentVote false when current index is out of bounds", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 99 };
  expect(hasCurrentVote(state, positions)).toBe(false);
});

test("allPositionsVoted false when some positions have no vote", () => {
  const state = selectCandidate(createVotingState(positions), "pos-1", "c1");
  expect(allPositionsVoted(state, positions)).toBe(false);
});

test("allPositionsVoted true when all positions have votes", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-2", "c3");
  state = selectCandidate(state, "pos-3", "c5");
  expect(allPositionsVoted(state, positions)).toBe(true);
});

test("allPositionsVoted true for empty positions", () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 };
  expect(allPositionsVoted(state, [])).toBe(true);
});

test("getSelectedVotes returns only non-null selections with positionId and candidateId", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-3", "c5");
  expect(getSelectedVotes(state)).toEqual([
    { positionId: "pos-1", candidateId: "c1" },
    { positionId: "pos-3", candidateId: "c5" },
  ]);
});

test("getSelectedVotes returns empty array when nothing selected", () => {
  const state = createVotingState(positions);
  expect(getSelectedVotes(state)).toEqual([]);
});

test("getSelectedCount counts non-null votes", () => {
  let state = createVotingState(positions);
  state = selectCandidate(state, "pos-1", "c1");
  state = selectCandidate(state, "pos-3", "c5");
  expect(getSelectedCount(state)).toBe(2);
});

test("getSelectedCount returns 0 when nothing selected", () => {
  const state = createVotingState(positions);
  expect(getSelectedCount(state)).toBe(0);
});
