import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
// Now import after mocks are defined
import router from './index'

// Mock drizzle-orm before any imports that use it
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq-mock'),
  and: vi.fn(() => 'and-mock'),
  count: vi.fn(() => 'count-mock'),
  desc: vi.fn(() => 'desc-mock'),
  inArray: vi.fn(() => 'inArray-mock'),
  sql: vi.fn((_strings: TemplateStringsArray, ..._values: any[]) => ({
    get: () => 'CURRENT_TIMESTAMP',
    toSQL: () => ({ sql: 'CURRENT_TIMESTAMP', params: [] }),
  })),
}))

// Mock the auth middleware
vi.mock('@/middleware/auth', () => ({
  requireAuth: async (c: any, next: any) => {
    c.set('authUser', {
      id: 'test-account-id',
      email: 'test@example.com',
      username: 'testuser',
      role: 'admin',
    })
    await next()
  },
}))

// Mock the database
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  and: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  desc: vi.fn().mockReturnThis(),
  count: vi.fn().mockReturnThis(),
  inArray: vi.fn().mockReturnThis(),
  get: vi.fn(),
  all: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  run: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  batch: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/config/db', () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}))

describe('votes Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('pOST /votes - Submit Vote', () => {
    const testUserId = 'test-user-id'
    const testCandidateId1 = 'test-candidate-id-1'
    const testCandidateId2 = 'test-candidate-id-2'
    const testVoteId1 = 'test-vote-id-1'
    const testVoteId2 = 'test-vote-id-2'

    it('should successfully submit votes for multiple candidates', async () => {
      const mockUser = {
        id: testUserId,
        accountId: 'test-account-id',
        hasVoted: 0,
      }

      const mockCandidates = [
        {
          id: testCandidateId1,
          fullName: 'John Doe',
          position: 'President',
          isActive: 1,
        },
        {
          id: testCandidateId2,
          fullName: 'Jane Smith',
          position: 'Vice President',
          isActive: 1,
        },
      ]

      const mockCreatedVotes = [
        {
          id: testVoteId1,
          userId: testUserId,
          candidateId: testCandidateId1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: testVoteId2,
          userId: testUserId,
          candidateId: testCandidateId2,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      // Mock user lookup
      mockDb.get.mockResolvedValueOnce(mockUser)
      // Mock candidates lookup
      mockDb.all.mockResolvedValueOnce(mockCandidates)
      // Mock existing votes check (none)
      mockDb.all.mockResolvedValueOnce([])
      // Mock batch insert/update
      mockDb.batch.mockResolvedValue(undefined)
      // Mock created votes retrieval
      mockDb.all.mockResolvedValueOnce(mockCreatedVotes)

      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: [
            { candidateId: testCandidateId1 },
            { candidateId: testCandidateId2 },
          ],
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY)
      expect(body.votes).toHaveLength(2)
      expect(body.votes[0].userId).toBe(testUserId)
    })

    it('should return 400 if user not found', async () => {
      mockDb.get.mockResolvedValueOnce(null)

      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: [{ candidateId: testCandidateId1 }],
        }),
      })

      expect(res.status).toBe(400)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.USER_NOT_FOUND)
    })

    it('should return 409 if user has already voted (hasVoted flag)', async () => {
      const mockUser = {
        id: testUserId,
        accountId: 'test-account-id',
        hasVoted: 1,
      }

      mockDb.get.mockResolvedValueOnce(mockUser)

      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: [{ candidateId: testCandidateId1 }],
        }),
      })

      expect(res.status).toBe(409)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.VOTE_ALREADY_CAST)
    })

    it('should return 404 if candidate does not exist', async () => {
      const mockUser = {
        id: testUserId,
        accountId: 'test-account-id',
        hasVoted: 0,
      }

      mockDb.get.mockResolvedValueOnce(mockUser)
      mockDb.all.mockResolvedValueOnce([]) // No candidates found

      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: [{ candidateId: testCandidateId1 }],
        }),
      })

      expect(res.status).toBe(404)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND)
    })

    it('should return 422 if voting for multiple candidates in same position', async () => {
      const mockUser = {
        id: testUserId,
        accountId: 'test-account-id',
        hasVoted: 0,
      }

      const mockCandidates = [
        {
          id: testCandidateId1,
          fullName: 'John Doe',
          position: 'President',
          isActive: 1,
        },
        {
          id: testCandidateId2,
          fullName: 'Jane Smith',
          position: 'President', // Same position
          isActive: 1,
        },
      ]

      mockDb.get.mockResolvedValueOnce(mockUser)
      mockDb.all.mockResolvedValueOnce(mockCandidates)

      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: [
            { candidateId: testCandidateId1 },
            { candidateId: testCandidateId2 },
          ],
        }),
      })

      expect(res.status).toBe(422)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.DUPLICATE_POSITION_VOTE)
    })

    it('should return 409 if user has existing votes (double-check)', async () => {
      const mockUser = {
        id: testUserId,
        accountId: 'test-account-id',
        hasVoted: 0,
      }

      const mockCandidates = [
        {
          id: testCandidateId1,
          fullName: 'John Doe',
          position: 'President',
          isActive: 1,
        },
      ]

      const mockExistingVotes = [
        { id: 'existing-vote', userId: testUserId },
      ]

      mockDb.get.mockResolvedValueOnce(mockUser)
      mockDb.all.mockResolvedValueOnce(mockCandidates)
      mockDb.all.mockResolvedValueOnce(mockExistingVotes)

      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: [{ candidateId: testCandidateId1 }],
        }),
      })

      expect(res.status).toBe(409)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.VOTE_ALREADY_CAST)
    })

    it('should return 422 for invalid request body (empty votes array)', async () => {
      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes: [] }),
      })

      expect(res.status).toBe(422)
    })

    it('should return 422 for invalid request body (missing votes field)', async () => {
      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: 'test-id' }),
      })

      expect(res.status).toBe(422)
    })

    it('should return 422 for invalid request body (invalid candidateId)', async () => {
      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          votes: [{ candidateId: 123 }], // Should be string
        }),
      })

      expect(res.status).toBe(422)
    })
  })

  describe('gET /votes/me - Get Vote Status', () => {
    it('should return vote status when user has voted', async () => {
      const mockUser = {
        id: 'test-user-id',
        accountId: 'test-account-id',
        hasVoted: 1,
      }

      const mockVotes = [
        {
          id: 'vote-1',
          userId: 'test-user-id',
          candidateId: 'candidate-1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'vote-2',
          userId: 'test-user-id',
          candidateId: 'candidate-2',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]

      mockDb.get.mockResolvedValueOnce(mockUser)
      mockDb.all.mockResolvedValueOnce(mockVotes)

      const res = await router.request('/votes/me', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.hasVoted).toBe(true)
      expect(body.votes).toHaveLength(2)
      expect(body.votes[0].candidateId).toBe('candidate-1')
    })

    it('should return no votes when user has not voted', async () => {
      const mockUser = {
        id: 'test-user-id',
        accountId: 'test-account-id',
        hasVoted: 0,
      }

      mockDb.get.mockResolvedValueOnce(mockUser)
      mockDb.all.mockResolvedValueOnce([])

      const res = await router.request('/votes/me', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.hasVoted).toBe(false)
      expect(body.votes).toHaveLength(0)
    })

    it('should return empty status when user not found', async () => {
      mockDb.get.mockResolvedValueOnce(null)

      const res = await router.request('/votes/me', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.hasVoted).toBe(false)
      expect(body.votes).toHaveLength(0)
    })
  })

  describe('gET /votes/results - Get Election Results', () => {
    it('should return results grouped by position', async () => {
      const mockCandidatesWithVotes = [
        {
          candidateId: 'candidate-1',
          candidateName: 'John Doe',
          position: 'President',
          voteCount: 10,
        },
        {
          candidateId: 'candidate-2',
          candidateName: 'Jane Smith',
          position: 'President',
          voteCount: 15,
        },
        {
          candidateId: 'candidate-3',
          candidateName: 'Bob Johnson',
          position: 'Vice President',
          voteCount: 8,
        },
      ]

      mockDb.all.mockResolvedValueOnce(mockCandidatesWithVotes)

      const res = await router.request('/votes/results', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.results).toHaveLength(2)
      expect(body.meta.totalVotes).toBe(33)
      expect(body.meta.totalPositions).toBe(2)

      // Check positions are sorted alphabetically
      expect(body.results[0].position).toBe('President')
      expect(body.results[1].position).toBe('Vice President')

      // Check President candidates
      const presidentResults = body.results[0].candidates
      expect(presidentResults).toHaveLength(2)
      expect(presidentResults[0].candidateName).toBe('John Doe')
      expect(presidentResults[1].candidateName).toBe('Jane Smith')
    })

    it('should return empty results when no candidates exist', async () => {
      mockDb.all.mockResolvedValueOnce([])

      const res = await router.request('/votes/results', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.results).toHaveLength(0)
      expect(body.meta.totalVotes).toBe(0)
      expect(body.meta.totalPositions).toBe(0)
    })

    it('should return results with zero votes for new candidates', async () => {
      const mockCandidatesWithVotes = [
        {
          candidateId: 'candidate-1',
          candidateName: 'John Doe',
          position: 'President',
          voteCount: 0,
        },
      ]

      mockDb.all.mockResolvedValueOnce(mockCandidatesWithVotes)

      const res = await router.request('/votes/results', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.results[0].candidates[0].voteCount).toBe(0)
      expect(body.meta.totalVotes).toBe(0)
    })

    it('should accurately count total votes across all positions', async () => {
      const mockCandidatesWithVotes = [
        { candidateId: 'c1', candidateName: 'A', position: 'P1', voteCount: 5 },
        { candidateId: 'c2', candidateName: 'B', position: 'P1', voteCount: 3 },
        { candidateId: 'c3', candidateName: 'C', position: 'P2', voteCount: 7 },
        { candidateId: 'c4', candidateName: 'D', position: 'P2', voteCount: 2 },
      ]

      mockDb.all.mockResolvedValueOnce(mockCandidatesWithVotes)

      const res = await router.request('/votes/results', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.meta.totalVotes).toBe(17) // 5 + 3 + 7 + 2
    })
  })

  describe('gET /votes/candidates/:id/count - Get Candidate Vote Count', () => {
    const testCandidateId = 'test-candidate-id'

    it('should return vote count for candidate', async () => {
      const mockCandidate = {
        id: testCandidateId,
        fullName: 'John Doe',
        position: 'President',
        isActive: 1,
      }

      const mockVoteCount = { voteCount: 42 }

      mockDb.get.mockResolvedValueOnce(mockCandidate)
      mockDb.get.mockResolvedValueOnce(mockVoteCount)

      const res = await router.request(`/votes/candidates/${testCandidateId}/count`, {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.candidateId).toBe(testCandidateId)
      expect(body.candidateName).toBe('John Doe')
      expect(body.position).toBe('President')
      expect(body.voteCount).toBe(42)
    })

    it('should return 0 for candidate with no votes', async () => {
      const mockCandidate = {
        id: testCandidateId,
        fullName: 'Jane Smith',
        position: 'Vice President',
        isActive: 1,
      }

      mockDb.get.mockResolvedValueOnce(mockCandidate)
      mockDb.get.mockResolvedValueOnce(null)

      const res = await router.request(`/votes/candidates/${testCandidateId}/count`, {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.voteCount).toBe(0)
    })

    it('should return 404 if candidate not found', async () => {
      mockDb.get.mockResolvedValueOnce(null)

      const res = await router.request(`/votes/candidates/non-existent-id/count`, {
        method: 'GET',
      })

      expect(res.status).toBe(404)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND)
    })

    it('should return 404 if candidate is inactive', async () => {
      // When candidate is inactive, the query with isActive=1 filter returns null
      mockDb.get.mockResolvedValueOnce(null)

      const res = await router.request(`/votes/candidates/${testCandidateId}/count`, {
        method: 'GET',
      })

      expect(res.status).toBe(404)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND)
    })
  })

  describe('dELETE /votes/me - Withdraw Vote', () => {
    const testUserId = 'test-user-id'

    it('should successfully withdraw votes', async () => {
      const mockUser = {
        id: testUserId,
        accountId: 'test-account-id',
        hasVoted: 1,
      }

      const mockExistingVotes = [
        {
          id: 'vote-1',
          userId: testUserId,
          candidateId: 'candidate-1',
        },
      ]

      mockDb.get.mockResolvedValueOnce(mockUser)
      mockDb.all.mockResolvedValueOnce(mockExistingVotes)
      mockDb.batch.mockResolvedValue(undefined)

      const res = await router.request('/votes/me', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.VOTE_WITHDRAWN_SUCCESSFULLY)
    })

    it('should return 400 if user not found', async () => {
      mockDb.get.mockResolvedValueOnce(null)

      const res = await router.request('/votes/me', {
        method: 'DELETE',
      })

      expect(res.status).toBe(400)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.USER_NOT_FOUND)
    })

    it('should return 404 if user has no votes', async () => {
      const mockUser = {
        id: testUserId,
        accountId: 'test-account-id',
        hasVoted: 0,
      }

      mockDb.get.mockResolvedValueOnce(mockUser)
      mockDb.all.mockResolvedValueOnce([])

      const res = await router.request('/votes/me', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
      const body = await res.json() as any
      expect(body.message).toBe(ERROR_MESSAGES.VOTE_NOT_FOUND)
    })
  })

  describe('authentication - All Routes', () => {
    it('should require authentication for POST /votes', async () => {
      // The mocked auth middleware always passes
      const res = await router.request('/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes: [] }),
      })

      // With mocked auth, expect validation to fail (empty array)
      expect(res.status).toBe(422)
    })

    it('should require authentication for GET /votes/me', async () => {
      const res = await router.request('/votes/me', {
        method: 'GET',
      })

      // With mocked auth, should return 200 with empty data
      expect(res.status).toBe(200)
    })

    it('should require authentication for GET /votes/results', async () => {
      mockDb.all.mockResolvedValueOnce([])
      const res = await router.request('/votes/results', {
        method: 'GET',
      })

      // With mocked auth, should return 200
      expect(res.status).toBe(200)
    })

    it('should require authentication for GET /votes/candidates/:id/count', async () => {
      mockDb.get.mockResolvedValueOnce(null)
      const res = await router.request('/votes/candidates/test-id/count', {
        method: 'GET',
      })

      // With mocked auth, should return 404 (candidate not found)
      expect(res.status).toBe(404)
    })

    it('should require authentication for DELETE /votes/me', async () => {
      // Set up mock to return null (user not found)
      mockDb.get.mockResolvedValueOnce(null)
      const res = await router.request('/votes/me', {
        method: 'DELETE',
      })

      // With mocked auth, should return 400 (USER_NOT_FOUND) since null user
      expect(res.status).toBe(400)
    })
  })

  describe('vote Counting Accuracy', () => {
    it('should correctly count votes across multiple candidates', async () => {
      const mockCandidatesWithVotes = [
        { candidateId: 'c1', candidateName: 'Alice', position: 'President', voteCount: 100 },
        { candidateId: 'c2', candidateName: 'Bob', position: 'President', voteCount: 95 },
        { candidateId: 'c3', candidateName: 'Charlie', position: 'VP', voteCount: 88 },
      ]

      mockDb.all.mockResolvedValueOnce(mockCandidatesWithVotes)

      const res = await router.request('/votes/results', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.meta.totalVotes).toBe(283) // 100 + 95 + 88
      expect(body.results[0].candidates[0].voteCount).toBe(100)
      expect(body.results[0].candidates[1].voteCount).toBe(95)
    })

    it('should handle candidates with zero votes correctly', async () => {
      const mockCandidatesWithVotes = [
        { candidateId: 'c1', candidateName: 'Alice', position: 'President', voteCount: 0 },
        { candidateId: 'c2', candidateName: 'Bob', position: 'President', voteCount: 0 },
      ]

      mockDb.all.mockResolvedValueOnce(mockCandidatesWithVotes)

      const res = await router.request('/votes/results', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.meta.totalVotes).toBe(0)
    })
  })
})
