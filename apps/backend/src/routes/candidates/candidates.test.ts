import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accounts } from '@/database/schema'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import router from './index'

// Mock the auth middleware
vi.mock('@/middleware/auth', () => ({
  requireAuth: async (c: any, next: any) => {
    c.set('authUser', {
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      role: 'admin',
    })
    await next()
  },
}))

// Mock the database
let mockDb: any

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    batch: vi.fn().mockResolvedValue(undefined),
  }
}

mockDb = createMockDb()

vi.mock('@/config/db', () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}))

// Hoisted mocks
const {
  mockExistsActiveForAccountPosition,
  mockCreate,
  mockListForAdminTable,
  mockGetForAdminView,
  mockUpdate,
  mockSoftDelete,
} = vi.hoisted(() => ({
  mockExistsActiveForAccountPosition: vi.fn(),
  mockCreate: vi.fn(),
  mockListForAdminTable: vi.fn(),
  mockGetForAdminView: vi.fn(),
  mockUpdate: vi.fn(),
  mockSoftDelete: vi.fn(),
}))

vi.mock('@/database/repositories/candidates.repository', () => ({
  candidateRepo: {
    existsActiveForAccountPosition: mockExistsActiveForAccountPosition,
    create: mockCreate,
    listForAdminTable: mockListForAdminTable,
    getForAdminView: mockGetForAdminView,
    update: mockUpdate,
    softDelete: mockSoftDelete,
  },
}))

describe('candidate Routes (repository)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    mockExistsActiveForAccountPosition.mockReset()
    mockCreate.mockReset()
    mockListForAdminTable.mockReset()
    mockGetForAdminView.mockReset()
    mockUpdate.mockReset()
    mockSoftDelete.mockReset()
  })

  describe('pOST /candidates (createCandidate)', () => {
    it('should create a new candidate successfully', async () => {
      const input = {
        fullName: 'Jane Doe',
        accountId: 'account-123',
        position: 'President',
        manifesto: 'Change the world',
      }
      mockExistsActiveForAccountPosition.mockResolvedValue(false)
      mockCreate.mockResolvedValue('new-candidate-id')

      // Mock account lookup: SELECT * FROM accounts WHERE id = ?
      mockDb.select.mockImplementationOnce(() => mockDb)
      mockDb.from.mockImplementationOnce((table: any) =>
        table === accounts ? mockDb : mockDb,
      )
      mockDb.where.mockImplementationOnce(() => mockDb)
      mockDb.get.mockResolvedValueOnce({
        id: input.accountId,
        username: 'testacc',
        role: 'user',
      })

      const res = await router.request('/candidates', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY)
      expect(json.candidate).toMatchObject({
        id: 'new-candidate-id',
        ...input,
      })
    })

    it('should return 409 if candidate already exists for account+position', async () => {
      const input = {
        fullName: 'Jane Doe',
        accountId: 'account-123',
        position: 'President',
        manifesto: 'Change the world',
      }
      mockExistsActiveForAccountPosition.mockResolvedValue(true)

      // Account exists, still need to pass account check to reach existsActive check
      mockDb.select.mockImplementationOnce(() => mockDb)
      mockDb.from.mockImplementationOnce((table: any) =>
        table === accounts ? mockDb : mockDb,
      )
      mockDb.where.mockImplementationOnce(() => mockDb)
      mockDb.get.mockResolvedValueOnce({ id: input.accountId })

      const res = await router.request('/candidates', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(409)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_ALREADY_EXISTS)
    })
  })

  describe('gET /candidates (listCandidates)', () => {
    it('should list candidates with pagination', async () => {
      const mockCandidates = [
        {
          id: '1',
          fullName: 'Alice',
          accountId: 'acc1',
          position: 'President',
          manifesto: '...',
          isActive: 1,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]
      mockListForAdminTable.mockResolvedValue({
        data: mockCandidates,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      })

      const res = await router.request('/candidates?page=1&limit=10', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data).toHaveLength(1)
      expect(json.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      })
    })

    it('should include inactive candidates when includeDeleted=true', async () => {
      const mockCandidates = [
        {
          id: '1',
          fullName: 'Alice',
          isActive: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]
      mockListForAdminTable.mockResolvedValue({
        data: mockCandidates,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      })

      const res = await router.request(
        '/candidates?page=1&limit=10&includeDeleted=true',
        { method: 'GET' },
      )

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.data[0].isActive).toBe(0)
    })
  })

  describe('gET /candidates/:id (getCandidate)', () => {
    it('should return candidate by id', async () => {
      const mockCandidate = {
        id: 'cand-1',
        fullName: 'Bob',
        accountId: 'acc1',
        position: 'Secretary',
        manifesto: '...',
        isActive: 1,
        createdAt: 1000,
        updatedAt: 1000,
      }
      mockGetForAdminView.mockResolvedValue(mockCandidate)

      const res = await router.request('/candidates/cand-1', { method: 'GET' })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe('cand-1')
    })

    it('should return 404 if candidate not found', async () => {
      mockGetForAdminView.mockResolvedValue(null)

      const res = await router.request('/candidates/unknown', {
        method: 'GET',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('pATCH /candidates/:id (updateCandidate)', () => {
    it('should update candidate successfully', async () => {
      let getCallCount = 0
      mockGetForAdminView.mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return { id: 'cand-1', isActive: 1, accountId: 'acc1' }
        }
        return {
          id: 'cand-1',
          fullName: 'Updated Name',
          accountId: 'acc1',
          position: 'President',
          manifesto: 'Updated',
          isActive: 1,
          createdAt: 1000,
          updatedAt: 1000,
        }
      })

      const res = await router.request('/candidates/cand-1', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: 'Updated Name',
          manifesto: 'Updated',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY)
    })

    it('should return 404 if candidate not found on update', async () => {
      mockGetForAdminView.mockResolvedValue(null)

      const res = await router.request('/candidates/cand-1', {
        method: 'PUT',
        body: JSON.stringify({ fullName: 'Updated' }),
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(404)
    })
  })

  describe('dELETE /candidates/:id (deleteCandidate)', () => {
    it('should soft-delete candidate', async () => {
      mockGetForAdminView.mockResolvedValue({ id: 'cand-1', isActive: 1 })
      mockSoftDelete.mockResolvedValue(true)

      const res = await router.request('/candidates/cand-1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY)
    })

    it('should return 404 if candidate not found on delete', async () => {
      mockGetForAdminView.mockImplementation(async () => null)
      const res = await router.request('/candidates/cand-1', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })
})
