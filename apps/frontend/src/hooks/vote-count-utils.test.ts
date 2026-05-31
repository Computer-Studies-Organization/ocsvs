import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeVoteCounts } from './vote-count-utils'

test('mergeVoteCounts returns empty map for empty inputs', () => {
  const result = mergeVoteCounts([], [])
  assert.deepEqual(result.voteCounts, {})
  assert.equal(result.isLoading, false)
})

test('mergeVoteCounts extracts voteCount from object data', () => {
  const result = mergeVoteCounts(
    ['c1', 'c2'],
    [
      { data: { candidateId: 'c1', candidateName: 'Alice', position: 'president', voteCount: 5 }, isLoading: false },
      { data: { candidateId: 'c2', candidateName: 'Bob', position: 'president', voteCount: 12 }, isLoading: false },
    ],
  )
  assert.deepEqual(result.voteCounts, { c1: 5, c2: 12 })
  assert.equal(result.isLoading, false)
})

test('mergeVoteCounts extracts voteCount from full API response shape', () => {
  const result = mergeVoteCounts(
    ['c1'],
    [{ data: { candidateId: 'c1', candidateName: 'Alice', position: 'president', voteCount: 42 }, isLoading: false }],
  )
  assert.deepEqual(result.voteCounts, { c1: 42 })
  assert.equal(result.isLoading, false)
})

test('mergeVoteCounts reports loading when any query is loading', () => {
  const result = mergeVoteCounts(
    ['c1', 'c2'],
    [
      { data: { candidateId: 'c1', candidateName: 'Alice', position: 'president', voteCount: 5 }, isLoading: false },
      { data: undefined, isLoading: true },
    ],
  )
  assert.equal(result.isLoading, true)
})

test('mergeVoteCounts skips entries with no query result', () => {
  const result = mergeVoteCounts(
    ['c1', 'c2'],
    [{ data: { candidateId: 'c1', candidateName: 'Alice', position: 'president', voteCount: 5 }, isLoading: false }],
  )
  assert.deepEqual(result.voteCounts, { c1: 5 })
})

test('mergeVoteCounts handles undefined data gracefully', () => {
  const result = mergeVoteCounts(
    ['c1', 'c2'],
    [{ data: undefined, isLoading: false }, { data: { candidateId: 'c2', candidateName: 'Bob', position: 'vp', voteCount: 3 }, isLoading: false }],
  )
  assert.deepEqual(result.voteCounts, { c2: 3 })
  assert.equal(result.isLoading, false)
})
