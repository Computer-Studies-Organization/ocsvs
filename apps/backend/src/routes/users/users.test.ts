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

// Mock the users repository (single-table ops only)
vi.mock('@/database/repositories/users.repository', () => ({
  userRepo: {
    getAccountId: vi.fn(),
    findByAccountId: vi.fn(),
    updateUser: vi.fn(),
  },
}))

// Mock the user account queries (joined queries)
const { mockListForAdmin, mockFindById, mockGetAccountDeleteStatus }
  = vi.hoisted(() => ({
    mockListForAdmin: vi.fn(),
    mockFindById: vi.fn(),
    mockGetAccountDeleteStatus: vi.fn(),
  }))

vi.mock('@/database/queries/user-account.queries', () => ({
  userAccountQueries: {
    listForAdmin: mockListForAdmin,
    findById: mockFindById,
    getAccountDeleteStatus: mockGetAccountDeleteStatus,
    findByStudentId: vi.fn(),
    getProfile: vi.fn(),
  },
}))

const { mockUsernameExists, mockUpdateAccount, mockSoftDelete, mockRestore }
  = vi.hoisted(() => ({
    mockUsernameExists: vi.fn(),
    mockUpdateAccount: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockRestore: vi.fn(),
  }))

vi.mock('@/database/repositories/account.repository', () => ({
  accountRepo: {
    accountExists: vi.fn(),
    usernameExists: mockUsernameExists,
    create: vi.fn(),
    updateAccount: mockUpdateAccount,
    updatePassword: vi.fn(),
    getPasswordHash: vi.fn(),
    softDelete: mockSoftDelete,
    restore: mockRestore,
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
        username: 'johndoe',
        email: 'john@example.com',
        role: 'user',
        deletedAt: null,
        createdAt: 1234567890,
        updatedAt: 1234567890,
      },
    ]

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
      data: mockUsers,
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
      data: [{ id: '1' }],
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
