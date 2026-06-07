import type { TPositionGroup } from './voting-stepper-logic'
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allPositionsVoted,
  createVotingState,
  getSelectedCandidateIds,
  getSelectedCount,
  goNext,
  goPrevious,
  hasCurrentVote,
  isFirstPosition,
  isLastPosition,
  selectCandidate,

} from './voting-stepper-logic'

const groups: TPositionGroup[] = [
  { id: 'president', title: 'President', description: 'President', candidates: [{ id: 'c1', fullName: 'Alice', accountId: 'a1', position: 'president', manifesto: '' }, { id: 'c2', fullName: 'Bob', accountId: 'a2', position: 'president', manifesto: '' }] },
  { id: 'vice-president', title: 'Vice President', description: 'Vice President', candidates: [{ id: 'c3', fullName: 'Charlie', accountId: 'a3', position: 'vice-president', manifesto: '' }, { id: 'c4', fullName: 'Dave', accountId: 'a4', position: 'vice-president', manifesto: '' }] },
  { id: 'secretary', title: 'Secretary', description: 'Secretary', candidates: [{ id: 'c5', fullName: 'Eve', accountId: 'a5', position: 'secretary', manifesto: '' }] },
]

test('createVotingState initializes all positions to null and index to 0', () => {
  const state = createVotingState(groups)
  assert.deepEqual(state.selectedVotes, { 'president': null, 'vice-president': null, 'secretary': null })
  assert.equal(state.currentPositionIndex, 0)
})

test('selectCandidate sets vote for correct position', () => {
  const state = createVotingState(groups)
  const next = selectCandidate(state, 'president', 'c1')
  assert.equal(next.selectedVotes.president, 'c1')
  assert.equal(next.selectedVotes['vice-president'], null)
})

test('selectCandidate can change an existing vote', () => {
  let state = createVotingState(groups)
  state = selectCandidate(state, 'president', 'c1')
  state = selectCandidate(state, 'president', 'c2')
  assert.equal(state.selectedVotes.president, 'c2')
})

test('goNext advances index', () => {
  const state = createVotingState(groups)
  const next = goNext(state, groups.length)
  assert.equal(next.currentPositionIndex, 1)
})

test('goNext does not exceed last index', () => {
  const state = { selectedVotes: {}, currentPositionIndex: 2 }
  const next = goNext(state, 3)
  assert.equal(next.currentPositionIndex, 2)
})

test('goNext does not go below 0 when totalPositions is 0', () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 }
  const next = goNext(state, 0)
  assert.equal(next.currentPositionIndex, 0)
})

test('goPrevious decrements index', () => {
  const state = { selectedVotes: {}, currentPositionIndex: 2 }
  const next = goPrevious(state)
  assert.equal(next.currentPositionIndex, 1)
})

test('goPrevious does not go below 0', () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 }
  const next = goPrevious(state)
  assert.equal(next.currentPositionIndex, 0)
})

test('isFirstPosition true at 0, false otherwise', () => {
  assert.equal(isFirstPosition({ selectedVotes: {}, currentPositionIndex: 0 }), true)
  assert.equal(isFirstPosition({ selectedVotes: {}, currentPositionIndex: 1 }), false)
})

test('isLastPosition true at last, false otherwise', () => {
  assert.equal(isLastPosition({ selectedVotes: {}, currentPositionIndex: 2 }, 3), true)
  assert.equal(isLastPosition({ selectedVotes: {}, currentPositionIndex: 0 }, 3), false)
})

test('hasCurrentVote false when no vote for current position', () => {
  const state = createVotingState(groups)
  assert.equal(hasCurrentVote(state, groups), false)
})

test('hasCurrentVote true when vote exists for current position', () => {
  const state = selectCandidate(createVotingState(groups), 'president', 'c1')
  assert.equal(hasCurrentVote(state, groups), true)
})

test('hasCurrentVote false when current index is out of bounds', () => {
  const state = { selectedVotes: {}, currentPositionIndex: 99 }
  assert.equal(hasCurrentVote(state, groups), false)
})

test('allPositionsVoted false when some positions have no vote', () => {
  const state = selectCandidate(createVotingState(groups), 'president', 'c1')
  assert.equal(allPositionsVoted(state, groups), false)
})

test('allPositionsVoted true when all positions have votes', () => {
  let state = createVotingState(groups)
  state = selectCandidate(state, 'president', 'c1')
  state = selectCandidate(state, 'vice-president', 'c3')
  state = selectCandidate(state, 'secretary', 'c5')
  assert.equal(allPositionsVoted(state, groups), true)
})

test('allPositionsVoted true for empty groups', () => {
  const state = { selectedVotes: {}, currentPositionIndex: 0 }
  assert.equal(allPositionsVoted(state, []), true)
})

test('getSelectedCandidateIds returns only non-null selections', () => {
  const state = selectCandidate(createVotingState(groups), 'president', 'c1')
  assert.deepEqual(getSelectedCandidateIds(state), ['c1'])
})

test('getSelectedCandidateIds returns empty array when nothing selected', () => {
  const state = createVotingState(groups)
  assert.deepEqual(getSelectedCandidateIds(state), [])
})

test('getSelectedCount counts non-null votes', () => {
  let state = createVotingState(groups)
  state = selectCandidate(state, 'president', 'c1')
  state = selectCandidate(state, 'secretary', 'c5')
  assert.equal(getSelectedCount(state), 2)
})

test('getSelectedCount returns 0 when nothing selected', () => {
  const state = createVotingState(groups)
  assert.equal(getSelectedCount(state), 0)
})
