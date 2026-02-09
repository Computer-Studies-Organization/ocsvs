
import { describe, it, expect, vi, beforeEach } from 'vitest'
import router from './index'
import * as dbConfig from '@/config/db'
import { AppBindings } from '@/lib/types/app-types'

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
    }
}))

// Mock the database
const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
}

vi.mock('@/config/db', () => ({
    createDb: vi.fn(() => ({ db: mockDb }))
}))

describe('Users Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('GET /users should return paginated list of users', async () => {
        const mockUsers = [
            {
                id: '1',
                firstName: 'John',
                lastName: 'Doe',
                studentId: '123456',
                accountId: 'acc1',
                yearLevel: '4th Year',
                course: 'BSCS',
                hasVoted: 0,
                createdAt: 1234567890,
                updatedAt: 1234567890,
            }
        ]

        mockDb.all.mockResolvedValue(mockUsers)
        mockDb.get.mockResolvedValue({ count: 1 })

        const res = await router.request('/users?page=1&limit=10', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        const body = await res.json() as any

        expect(body).toEqual({
            data: mockUsers,
            meta: {
                total: 1,
                page: 1,
                limit: 10,
                totalPages: 1,
            }
        })
        expect(mockDb.select).toHaveBeenCalledTimes(2)
        expect(mockDb.from).toHaveBeenCalledTimes(2)
        expect(mockDb.limit).toHaveBeenCalledWith(10)
        expect(mockDb.offset).toHaveBeenCalledWith(0)
    })

    it('GET /users with defaults should use page 1 and limit 10', async () => {
        const mockUsers = [{ id: '1' }]
        mockDb.all.mockResolvedValue(mockUsers)
        mockDb.get.mockResolvedValue({ count: 1 })

        const res = await router.request('/users', { method: 'GET' })

        expect(res.status).toBe(200)
        const body = await res.json() as any

        expect(body.meta).toEqual({
            total: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
        })
        expect(mockDb.limit).toHaveBeenCalledWith(10)
        expect(mockDb.offset).toHaveBeenCalledWith(0)
    })

    it('GET /users with custom params should use provided page and limit', async () => {
        mockDb.all.mockResolvedValue([])
        mockDb.get.mockResolvedValue({ count: 20 })

        const res = await router.request('/users?page=2&limit=5', { method: 'GET' })

        expect(res.status).toBe(200)
        const body = await res.json() as any

        expect(body.meta).toEqual({
            total: 20,
            page: 2,
            limit: 5,
            totalPages: 4,
        })
        expect(mockDb.limit).toHaveBeenCalledWith(5)
        expect(mockDb.offset).toHaveBeenCalledWith(5)
    })
})
