import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import router from './index'

let TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  role: 'user',
}
let AUTH_ENABLED = true

vi.mock('@/middleware/auth', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!AUTH_ENABLED)
      return c.json({ message: 'Unauthorized' }, 401)
    c.set('authUser', { ...TEST_USER })
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
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
}

mockDb = createMockDb()

vi.mock('@/config/db', () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}))

const {
  mockList,
  mockFindById,
  mockCreate,
  mockUpdateStatus,
  mockUpdateMetadata,
  mockGetCurrentElection,
  mockCountPositions,
} = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockUpdateMetadata: vi.fn(),
  mockGetCurrentElection: vi.fn(),
  mockCountPositions: vi.fn(),
}))

vi.mock('@/database/repositories/election.repository', () => ({
  electionRepo: {
    list: mockList,
    findById: mockFindById,
    findOpen: vi.fn(),
    create: mockCreate,
    updateStatus: mockUpdateStatus,
    updateMetadata: mockUpdateMetadata,
  },
}))

vi.mock('@/database/queries/election.queries', () => ({
  electionQueries: {
    getCurrentElection: mockGetCurrentElection,
    getElectionWithPositions: vi.fn(),
    countPositions: mockCountPositions,
    getResults: vi.fn(),
  },
}))

const electionId = 'elec-001'

function makeElection(overrides: Record<string, any> = {}) {
  return {
    id: electionId,
    name: 'CSO 2026',
    description: null,
    status: 'draft',
    opensAt: null,
    closesAt: null,
    createdAt: 1738000000,
    updatedAt: 1738000000,
    ...overrides,
  }
}

describe('elections routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
    mockList.mockReset()
    mockFindById.mockReset()
    mockCreate.mockReset()
    mockUpdateStatus.mockReset()
    mockUpdateMetadata.mockReset()
    mockGetCurrentElection.mockReset()
    mockCountPositions.mockReset()
    TEST_USER = {
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      role: 'admin',
    }
    AUTH_ENABLED = true
  })

  const setUser = () => {
    TEST_USER = { ...TEST_USER, role: 'user' }
  }

  describe('authentication', () => {
    it('returns 401 when not authenticated for listElections', async () => {
      AUTH_ENABLED = false
      const res = await router.request('/elections', { method: 'GET' })
      expect(res.status).toBe(401)
    })

    it('returns 401 when not authenticated for createElection', async () => {
      AUTH_ENABLED = false
      const res = await router.request('/elections', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(401)
    })
  })

  describe('gET /elections (listElections)', () => {
    it('returns 200 with array of elections for admin', async () => {
      const rows = [makeElection({ id: 'e1' }), makeElection({ id: 'e2', status: 'open' })]
      mockList.mockResolvedValue(rows)
      const res = await router.request('/elections', { method: 'GET' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as any
      expect(json).toHaveLength(2)
      expect(mockList).toHaveBeenCalledWith(mockDb, undefined)
    })

    it('passes status filter through to repo', async () => {
      mockList.mockResolvedValue([])
      const res = await router.request('/elections?status=open', { method: 'GET' })
      expect(res.status).toBe(200)
      expect(mockList).toHaveBeenCalledWith(mockDb, { status: 'open' })
    })
  })

  describe('pOST /elections (createElection)', () => {
    it('returns 403 when caller is not admin', async () => {
      setUser()
      const res = await router.request('/elections', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(403)
    })

    it('returns 201 with the created election for admin', async () => {
      mockCreate.mockResolvedValue(electionId)
      mockFindById.mockResolvedValue(makeElection())
      const res = await router.request('/elections', {
        method: 'POST',
        body: JSON.stringify({ name: 'CSO 2026' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(201)
      const json = (await res.json()) as any
      expect(json.id).toBe(electionId)
      expect(json.name).toBe('CSO 2026')
    })
  })

  describe('gET /elections/current', () => {
    it('returns 200 with the open election', async () => {
      mockGetCurrentElection.mockResolvedValue(makeElection({ status: 'open' }))
      const res = await router.request('/elections/current', { method: 'GET' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as any
      expect(json.status).toBe('open')
    })

    it('returns 404 when no open election', async () => {
      mockGetCurrentElection.mockResolvedValue(null)
      const res = await router.request('/elections/current', { method: 'GET' })
      expect(res.status).toBe(404)
      const json = (await res.json()) as any
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_NOT_FOUND)
    })
  })

  describe('gET /elections/:id', () => {
    it('returns 200 with the election', async () => {
      mockFindById.mockResolvedValue(makeElection())
      const res = await router.request(`/elections/${electionId}`, { method: 'GET' })
      expect(res.status).toBe(200)
      const json = (await res.json()) as any
      expect(json.id).toBe(electionId)
    })

    it('returns 404 when not found', async () => {
      mockFindById.mockResolvedValue(null)
      const res = await router.request(`/elections/${electionId}`, { method: 'GET' })
      expect(res.status).toBe(404)
    })
  })

  describe('pATCH /elections/:id (updateElection)', () => {
    it('returns 403 when caller is not admin', async () => {
      setUser()
      const res = await router.request(`/elections/${electionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(403)
    })

    it('returns 200 when status is draft', async () => {
      mockFindById
        .mockResolvedValueOnce(makeElection({ status: 'draft' }))
        .mockResolvedValueOnce(makeElection({ status: 'draft', name: 'Renamed' }))
      const res = await router.request(`/elections/${electionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as any
      expect(json.name).toBe('Renamed')
    })

    it('returns 409 when status is open', async () => {
      mockFindById.mockResolvedValue(makeElection({ status: 'open' }))
      const res = await router.request(`/elections/${electionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(409)
      const json = (await res.json()) as any
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT)
    })

    it('returns 404 when election is missing', async () => {
      mockFindById.mockResolvedValue(null)
      const res = await router.request(`/elections/${electionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(404)
    })
  })

  describe('pOST /elections/:id/transitions (transitionElection)', () => {
    it('returns 403 when caller is not admin', async () => {
      setUser()
      const res = await router.request(`/elections/${electionId}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ to: 'open', opensAt: 1738000000, closesAt: 1738604800 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(403)
    })

    it('returns 404 when election is missing', async () => {
      mockFindById.mockResolvedValue(null)
      const res = await router.request(`/elections/${electionId}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ to: 'open', opensAt: 1738000000, closesAt: 1738604800 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(404)
    })

    it('returns 409 for invalid transition (open -> draft)', async () => {
      mockFindById.mockResolvedValue(makeElection({ status: 'open' }))
      const res = await router.request(`/elections/${electionId}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ to: 'draft' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(409)
      const json = (await res.json()) as any
      expect(json.message).toBe(ERROR_MESSAGES.INVALID_TRANSITION)
    })

    it('returns 400 when draft->open is missing opensAt/closesAt', async () => {
      mockFindById.mockResolvedValue(makeElection({ status: 'draft' }))
      mockCountPositions.mockResolvedValue(2)
      const res = await router.request(`/elections/${electionId}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ to: 'open' }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(400)
      const json = (await res.json()) as any
      expect(json.message).toBe(ERROR_MESSAGES.INVALID_TRANSITION_BODY)
    })

    it('returns 409 when draft->open with no positions', async () => {
      mockFindById.mockResolvedValue(makeElection({ status: 'draft' }))
      mockCountPositions.mockResolvedValue(0)
      const res = await router.request(`/elections/${electionId}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ to: 'open', opensAt: 1738000000, closesAt: 1738604800 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(409)
      const json = (await res.json()) as any
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_HAS_NO_POSITIONS)
    })

    it('returns 200 for valid draft->open transition', async () => {
      mockFindById.mockResolvedValue(makeElection({ status: 'draft' }))
      mockCountPositions.mockResolvedValue(2)
      mockUpdateStatus.mockResolvedValue(true)
      const res = await router.request(`/elections/${electionId}/transitions`, {
        method: 'POST',
        body: JSON.stringify({ to: 'open', opensAt: 1738000000, closesAt: 1738604800 }),
        headers: { 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(200)
      const json = (await res.json()) as any
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_OPENED_SUCCESSFULLY)
      expect(mockUpdateStatus).toHaveBeenCalled()
    })
  })
})
