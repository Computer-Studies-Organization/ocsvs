import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import router from './index'

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq-mock'),
  and: vi.fn(() => 'and-mock'),
  count: vi.fn(() => 'count-mock'),
  desc: vi.fn(() => 'desc-mock'),
  inArray: vi.fn(() => 'inArray-mock'),
  sql: vi.fn(() => ({
    get: () => 'CURRENT_TIMESTAMP',
    toSQL: () => ({ sql: 'CURRENT_TIMESTAMP', params: [] }),
  })),
}))

let TEST_USER = {
  id: 'test-user-id',
  accountId: 'test-account-id',
  hasVoted: 0,
  role: 'user',
}
let AUTH_ENABLED = true

vi.mock('@/middleware/auth', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!AUTH_ENABLED)
      return c.json({ message: 'Unauthorized' }, 401)
    c.set('authUser', {
      id: TEST_USER.id,
      email: 'test@example.com',
      username: 'testuser',
      role: TEST_USER.role,
    })
    await next()
  },
  requireAdmin: async (c: any, next: any) => {
    if (!AUTH_ENABLED || TEST_USER.role !== 'admin') {
      return c.json({ message: 'Forbidden' }, 403)
    }
    await next()
  },
}))

let mockDb: any

function createMockDb() {
  return {
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
}

mockDb = createMockDb()

vi.mock('@/config/db', () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}))

const { mockFindActiveByIds, mockListWithVoteCount, mockGetForAdminView, mockFindByAccountId, mockExistsForUser, mockFindByUserId, mockCountByCandidateId }
  = vi.hoisted(() => ({
    mockFindActiveByIds: vi.fn(),
    mockListWithVoteCount: vi.fn(),
    mockGetForAdminView: vi.fn(),
    mockFindByAccountId: vi.fn(),
    mockExistsForUser: vi.fn(),
    mockFindByUserId: vi.fn(),
    mockCountByCandidateId: vi.fn(),
  }))

vi.mock('@/database/repositories/candidates.repository', () => ({
  candidateRepo: {
    findActiveByIds: mockFindActiveByIds,
    listWithVoteCount: mockListWithVoteCount,
    getForAdminView: mockGetForAdminView,
  },
}))

vi.mock('@/database/repositories/users.repository', () => ({
  userRepo: {
    findByAccountId: mockFindByAccountId,
    findById: vi.fn(),
    findByStudentId: vi.fn(),
    listForAdmin: vi.fn(),
    getAccountId: vi.fn(),
    getAccountDeleteStatus: vi.fn(),
    updateUser: vi.fn(),
    setHasVoted: vi.fn(),
    getProfile: vi.fn(),
  },
}))

vi.mock('@/database/repositories/votes.repository', () => ({
  voteRepo: {
    findByUserId: mockFindByUserId,
    existsForUser: mockExistsForUser,
    countByCandidateId: mockCountByCandidateId,
    insertMany: vi.fn(),
    deleteByUserId: vi.fn(),
  },
}))

describe('votes Routes (repository)', () => {
  const testUserId = 'test-user-id'
  const testUserAccountId = 'test-account-id'
  const testCandidateId1 = 'test-candidate-id-1'
  const testCandidateId2 = 'test-candidate-id-2'
  const testVoteId1 = 'test-vote-id-1'
  const testVoteId2 = 'test-vote-id-2'

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    mockFindActiveByIds.mockReset()
    mockListWithVoteCount.mockReset()
    mockGetForAdminView.mockReset()
    mockFindByAccountId.mockReset()
    mockExistsForUser.mockReset()
    mockFindByUserId.mockReset()
    mockCountByCandidateId.mockReset()
    TEST_USER = {
      id: testUserId,
      accountId: testUserAccountId,
      hasVoted: 0,
      role: 'user',
    }
    AUTH_ENABLED = true
  })

  const setAdmin = () => {
    TEST_USER = { ...TEST_USER, role: 'admin' }
  }
  const setUser = () => {
    TEST_USER = { ...TEST_USER, role: 'user', hasVoted: 0 }
  }
  const setUserVoted = () => {
    TEST_USER = { ...TEST_USER, hasVoted: 1 }
  }

  describe('authentication & Authorization', () => {
    it('returns 401 when not authenticated for getMyVoteStatus', async () => {
      AUTH_ENABLED = false
      const res = await router.request('/votes/me', { method: 'GET' })
      expect(res.status).toBe(401)
    })

    it('returns 401 when not authenticated for submitVote', async () => {
      AUTH_ENABLED = false
      const res = await router.request('/votes', {
        method: 'POST',
        body: JSON.stringify({ votes: [] }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(401)
    })

    it('returns 401 when not authenticated for withdrawVote', async () => {
      AUTH_ENABLED = false
      const res = await router.request('/votes/me', { method: 'DELETE' })
      expect(res.status).toBe(401)
    })

    it('returns 401 when not authenticated for getVoteResults', async () => {
      AUTH_ENABLED = false
      const res = await router.request('/votes/results', { method: 'GET' })
      expect(res.status).toBe(401)
    })

    it('returns 403 when authenticated as non-admin for getVoteResults', async () => {
      setUser()
      const res = await router.request('/votes/results', { method: 'GET' })
      expect(res.status).toBe(403)
    })

    it('returns 403 when authenticated as non-admin for getCandidateVoteCount', async () => {
      setUser()
      const res = await router.request(
        `/votes/candidates/${testCandidateId1}/count`,
        { method: 'GET' },
      )
      expect(res.status).toBe(403)
    })
  })

  describe('pOST /votes - Submit Vote', () => {
    it('should successfully submit votes for multiple candidates', async () => {
      setUser()
      const mockUser = {
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 0,
      }

      mockFindByAccountId.mockResolvedValue(mockUser)
      mockExistsForUser.mockResolvedValue(false)
      mockFindActiveByIds.mockResolvedValue(
        new Map([
          [testCandidateId1, { id: testCandidateId1, position: 'President' }],
          [testCandidateId2, { id: testCandidateId2, position: 'Vice President' }],
        ]),
      )
      mockDb.insert.mockImplementationOnce(() => mockDb)
      mockDb.values.mockImplementationOnce(() => mockDb)
      mockDb.run.mockResolvedValueOnce({ changes: 2 })
      mockDb.update.mockImplementationOnce(() => mockDb)
      mockDb.set.mockImplementationOnce(() => mockDb)
      mockDb.run.mockResolvedValueOnce({ changes: 1 })
      mockFindByUserId.mockResolvedValue([
        {
          id: testVoteId1,
          userId: testUserId,
          candidateId: testCandidateId1,
          position: 'President',
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        },
        {
          id: testVoteId2,
          userId: testUserId,
          candidateId: testCandidateId2,
          position: 'Vice President',
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
        },
      ])

      const res = await router.request('/votes', {
        method: 'POST',
        body: JSON.stringify({
          votes: [
            { candidateId: testCandidateId1 },
            { candidateId: testCandidateId2 },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY)
      expect(json.votes).toHaveLength(2)
    })

    it('should return 409 if user has already voted', async () => {
      setUserVoted()
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 1,
      })

      const res = await router.request('/votes', {
        method: 'POST',
        body: JSON.stringify({ votes: [{ candidateId: testCandidateId1 }] }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(409)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.VOTE_ALREADY_CAST)
    })

    it('should return 422 for duplicate position votes', async () => {
      setUser()
      const mockUser = {
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 0,
      }
      mockFindByAccountId.mockResolvedValue(mockUser)
      mockExistsForUser.mockResolvedValue(false)

      mockFindActiveByIds.mockResolvedValue(
        new Map([
          [testCandidateId1, { id: testCandidateId1, position: 'President' }],
          [testCandidateId2, { id: testCandidateId2, position: 'President' }],
        ]),
      )

      const res = await router.request('/votes', {
        method: 'POST',
        body: JSON.stringify({
          votes: [
            { candidateId: testCandidateId1 },
            { candidateId: testCandidateId2 },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(422)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.DUPLICATE_POSITION_VOTE)
    })

    it('should return 404 for non-existent candidate', async () => {
      setUser()
      const mockUser = {
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 0,
      }
      mockFindByAccountId.mockResolvedValue(mockUser)
      mockExistsForUser.mockResolvedValue(false)

      mockFindActiveByIds.mockResolvedValue(new Map())

      const res = await router.request('/votes', {
        method: 'POST',
        body: JSON.stringify({ votes: [{ candidateId: testCandidateId1 }] }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND)
    })
  })

  describe('gET /votes/me - getMyVoteStatus', () => {
    it('should return vote status when user has votes', async () => {
      setUser()
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 1,
      })
      mockFindByUserId.mockResolvedValue([
        {
          id: testVoteId1,
          userId: testUserId,
          candidateId: testCandidateId1,
          position: 'President',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ])

      const res = await router.request('/votes/me', { method: 'GET' })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.hasVoted).toBe(true)
      expect(json.votes).toHaveLength(1)
    })

    it('should return empty votes when user has not voted', async () => {
      setUser()
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 0,
      })
      mockFindByUserId.mockResolvedValue([])

      const res = await router.request('/votes/me', { method: 'GET' })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ hasVoted: false, votes: [] })
    })
  })

  describe('gET /votes/results - getVoteResults', () => {
    it('should return vote results grouped by position', async () => {
      setAdmin()
      const mockResults = [
        {
          candidateId: testCandidateId1,
          candidateName: 'John Doe',
          position: 'President',
          voteCount: 5,
        },
        {
          candidateId: testCandidateId2,
          candidateName: 'Jane Smith',
          position: 'Vice President',
          voteCount: 3,
        },
      ]
      mockListWithVoteCount.mockResolvedValue(mockResults)

      const res = await router.request('/votes/results', { method: 'GET' })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.results).toHaveLength(2)
      expect(json.meta.totalVotes).toBe(8)
      expect(json.meta.totalPositions).toBe(2)
    })

    it('should include zero-vote candidates', async () => {
      setAdmin()
      const mockResults = [
        {
          candidateId: testCandidateId1,
          candidateName: 'John Doe',
          position: 'President',
          voteCount: 0,
        },
      ]
      mockListWithVoteCount.mockResolvedValue(mockResults)

      const res = await router.request('/votes/results', { method: 'GET' })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.results[0].candidates[0].voteCount).toBe(0)
    })
  })

  describe('dELETE /votes/me - withdrawVote', () => {
    it('should successfully withdraw votes', async () => {
      setUser()
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 1,
      })
      mockExistsForUser.mockResolvedValue(true)
      mockDb.delete.mockImplementationOnce(() => mockDb)
      mockDb.where.mockImplementationOnce(() => mockDb)
      mockDb.run.mockResolvedValueOnce({ changes: 1 })
      mockDb.update.mockImplementationOnce(() => mockDb)
      mockDb.set.mockImplementationOnce(() => mockDb)
      mockDb.run.mockResolvedValueOnce({ changes: 1 })

      const res = await router.request('/votes/me', { method: 'DELETE' })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.VOTE_WITHDRAWN_SUCCESSFULLY)
    })

    it('should return 404 when no votes found to withdraw', async () => {
      setUser()
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
        hasVoted: 0,
      })
      mockExistsForUser.mockResolvedValue(false)

      const res = await router.request('/votes/me', { method: 'DELETE' })

      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.VOTE_NOT_FOUND)
    })
  })
})
