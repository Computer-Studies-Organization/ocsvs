import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock createRouter to include a logger middleware
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
vi.mock('@/lib/create-app', async (importOriginal) => {
  const { OpenAPIHono } = await import('@hono/zod-openapi')
  const original = await importOriginal<typeof import('@/lib/create-app')>()
  return {
    ...original,
    createRouter: () => {
      const app = new OpenAPIHono({ strict: false })
      // Inject logger so handlers that access c.var.logger don't throw
      app.use('*', async (c: any, next: any) => {
        c.set('logger', mockLogger)
        await next()
      })
      return app
    },
  }
})

// Mock the auth middleware
vi.mock('@/middleware/auth', () => ({
  requireAuth: async (c: any, next: any) => {
    c.set('authUser', {
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
    })
    await next()
  },
  requireAdmin: async (_c: any, next: any) => {
    await next()
  },
}))

// Mock the database
vi.mock('@/config/db', () => ({
  createDb: vi.fn(() => ({ db: {} })),
}))

// Mock the account repository
const { mockAccountExists, mockCreate } = vi.hoisted(() => ({
  mockAccountExists: vi.fn(),
  mockCreate: vi.fn(),
}))

vi.mock('@/database/repositories/account.repository', () => ({
  accountRepo: {
    accountExists: mockAccountExists,
    create: mockCreate,
    usernameExists: vi.fn(),
    updateAccount: vi.fn(),
    updatePassword: vi.fn(),
    getPasswordHash: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
  },
}))

// Mock the user account queries
const { mockFindByStudentId } = vi.hoisted(() => ({
  mockFindByStudentId: vi.fn(),
}))

vi.mock('@/database/queries/user-account.queries', () => ({
  userAccountQueries: {
    findByStudentId: mockFindByStudentId,
    listForAdmin: vi.fn(),
    findById: vi.fn(),
    getAccountDeleteStatus: vi.fn(),
    getProfile: vi.fn(),
  },
}))

// Mock password functions
const { mockVerifyPassword } = vi.hoisted(() => ({
  mockVerifyPassword: vi.fn(),
}))

vi.mock('@/lib/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  verifyPassword: mockVerifyPassword,
}))

// Mock session functions
const { mockCreateSession, mockGetSessionIdFromCookie, mockDeleteSession } = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockGetSessionIdFromCookie: vi.fn(),
  mockDeleteSession: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  createSession: mockCreateSession,
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  getSessionIdFromCookie: mockGetSessionIdFromCookie,
  deleteSession: mockDeleteSession,
}))

// Import router AFTER all mocks are set up
const { default: router } = await import('./auth.index')

describe('auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register a new user', async () => {
    mockAccountExists.mockResolvedValue(false)
    mockCreate.mockResolvedValue(undefined)

    const res = await router.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        studentId: 'C23-01-1234-CSA001',
        course: 'BSCS',
        yearLevel: '1st Year',
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.message).toBe('User registered successfully')
    expect(body.user.username).toBe('johndoe')
    expect(body.user.role).toBe('user')
    expect(mockAccountExists).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalled()
  })

  it('should login a user', async () => {
    mockFindByStudentId.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      password_hash: 'hashed-password',
      deletedAt: null,
    })
    mockVerifyPassword.mockResolvedValue(true)
    mockCreateSession.mockResolvedValue({
      id: 'session-id',
      expiresAt: Date.now() + 86400000,
    })

    const res = await router.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentNumber: 'C23-01-1234-CSA001',
        password: 'password123',
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.message).toBe('User logged in successfully')
    expect(body.user.username).toBe('testuser')
    expect(mockFindByStudentId).toHaveBeenCalled()
    expect(mockCreateSession).toHaveBeenCalled()
  })

  it('should logout a user', async () => {
    mockGetSessionIdFromCookie.mockReturnValue('session-id')
    mockDeleteSession.mockResolvedValue(undefined)

    const res = await router.request('/logout', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.message).toBe('Logged out successfully')
    expect(mockGetSessionIdFromCookie).toHaveBeenCalled()
    expect(mockDeleteSession).toHaveBeenCalled()
  })

  it('should return current user from /me', async () => {
    const res = await router.request('/me', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.user.id).toBe('test-user-id')
    expect(body.user.username).toBe('testuser')
    expect(body.user.role).toBe('user')
  })

  // Error path tests

  it('should reject duplicate registration', async () => {
    mockAccountExists.mockResolvedValue(true)

    const res = await router.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        studentId: 'C23-01-1234-CSA001',
        course: 'BSCS',
        yearLevel: '1st Year',
      }),
    })

    expect(res.status).toBe(409)
    const body = (await res.json()) as any
    expect(body.message).toBe('User already exists')
    expect(mockAccountExists).toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('should return 409 when batch insert hits UNIQUE constraint (race condition)', async () => {
    mockAccountExists.mockResolvedValue(false)
    mockCreate.mockRejectedValue(
      new Error('UNIQUE constraint failed: accounts.username'),
    )

    const res = await router.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        username: 'johndoe',
        password: 'password123',
        studentId: 'C23-01-1234-CSA001',
        course: 'BSCS',
        yearLevel: '1st Year',
      }),
    })

    expect(res.status).toBe(409)
    const body = (await res.json()) as any
    expect(body.message).toBe('User already exists')
    expect(mockAccountExists).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalled()
  })

  it('should return 409 when batch insert hits UNIQUE constraint on studentId', async () => {
    mockAccountExists.mockResolvedValue(false)
    mockCreate.mockRejectedValue(
      new Error('UNIQUE constraint failed: users.student_id'),
    )

    const res = await router.request('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        username: 'janedoe',
        password: 'password123',
        studentId: 'C23-01-5678-CSA001',
        course: 'BSCS',
        yearLevel: '1st Year',
      }),
    })

    expect(res.status).toBe(409)
    const body = (await res.json()) as any
    expect(body.message).toBe('User already exists')
    expect(mockAccountExists).toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalled()
  })

  it('should reject login when user not found', async () => {
    mockFindByStudentId.mockResolvedValue(null)

    const res = await router.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentNumber: 'C23-01-1234-CSA001',
        password: 'password123',
      }),
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as any
    expect(body.message).toBe('Invalid credentials')
    expect(mockFindByStudentId).toHaveBeenCalled()
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('should reject login when user is deleted', async () => {
    mockFindByStudentId.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      password_hash: 'hashed-password',
      deletedAt: Date.now(),
    })

    const res = await router.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentNumber: 'C23-01-1234-CSA001',
        password: 'password123',
      }),
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as any
    expect(body.message).toBe('Invalid credentials')
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('should reject login with wrong password', async () => {
    mockFindByStudentId.mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
      role: 'user',
      password_hash: 'hashed-password',
      deletedAt: null,
    })
    mockVerifyPassword.mockResolvedValue(false)

    const res = await router.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentNumber: 'C23-01-1234-CSA001',
        password: 'wrongpassword',
      }),
    })

    expect(res.status).toBe(401)
    const body = (await res.json()) as any
    expect(body.message).toBe('Invalid credentials')
    expect(mockCreateSession).not.toHaveBeenCalled()
  })

  it('should logout successfully even without active session', async () => {
    mockGetSessionIdFromCookie.mockReturnValue(null)

    const res = await router.request('/logout', {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.message).toBe('Logged out successfully')
    expect(mockDeleteSession).not.toHaveBeenCalled()
  })
})
