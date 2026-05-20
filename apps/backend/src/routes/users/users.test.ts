import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  requireAdmin: async (_c: any, next: any) => {
    await next()
  },
}))

// Mock the database (handler still calls createDb)
vi.mock('@/config/db', () => ({
  createDb: vi.fn(() => ({ db: {} })),
}))

// Mock the users repository
const { mockListForAdmin, mockFindById, mockGetAccountId, mockGetAccountDeleteStatus, mockUsernameExists, mockSoftDelete, mockRestore }
  = vi.hoisted(() => ({
    mockListForAdmin: vi.fn(),
    mockFindById: vi.fn(),
    mockGetAccountId: vi.fn(),
    mockGetAccountDeleteStatus: vi.fn(),
    mockUsernameExists: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockRestore: vi.fn(),
  }))

vi.mock('@/database/repositories/users.repository', () => ({
  userRepo: {
    listForAdmin: mockListForAdmin,
    findById: mockFindById,
    getAccountId: mockGetAccountId,
    getAccountDeleteStatus: mockGetAccountDeleteStatus,
    usernameExists: mockUsernameExists,
    softDelete: mockSoftDelete,
    restore: mockRestore,
    findByAccountId: vi.fn(),
    findByStudentId: vi.fn(),
    accountExists: vi.fn(),
    create: vi.fn(),
    updateAccount: vi.fn(),
    updateUser: vi.fn(),
    setHasVoted: vi.fn(),
    getPasswordHash: vi.fn(),
    getProfile: vi.fn(),
  },
}))

describe('users Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return paginated list of users', async () => {
    const mockUsers = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        studentId: '123456',
        accountId: 'acc1',
        yearLevel: '4th Year',
        course: 'BSCS',
        hasVoted: 1,
        username: 'johndoe',
        email: 'john@example.com',
        role: 'user',
        deletedAt: null,
        createdAt: 1234567890,
        updatedAt: 1234567890,
      },
    ]
    const expectedUsers = [{ ...mockUsers[0], hasVoted: true }]

    mockListForAdmin.mockResolvedValue({
      data: mockUsers,
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    })

    const res = await router.request('/users?page=1&limit=10', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any

    expect(body).toEqual({
      data: expectedUsers,
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    })
    expect(mockListForAdmin).toHaveBeenCalled()
  })

  it('with defaults should use page 1 and limit 10', async () => {
    mockListForAdmin.mockResolvedValue({
      data: [{ id: '1', hasVoted: 0 }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    })

    const res = await router.request('/users', { method: 'GET' })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any

    expect(body.meta).toEqual({
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    })
    expect(mockListForAdmin).toHaveBeenCalled()
  })

  it('with custom params should use provided page and limit', async () => {
    mockListForAdmin.mockResolvedValue({
      data: [],
      meta: { total: 20, page: 2, limit: 5, totalPages: 4 },
    })

    const res = await router.request('/users?page=2&limit=5', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any

    expect(body.meta).toEqual({
      total: 20,
      page: 2,
      limit: 5,
      totalPages: 4,
    })
    expect(mockListForAdmin).toHaveBeenCalled()
  })

  it('should request newest users first so fresh registrations appear on page one', async () => {
    mockListForAdmin.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
    })

    const res = await router.request('/users?page=1&limit=100', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    expect(mockListForAdmin).toHaveBeenCalled()
  })
})
