
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
    all: vi.fn(),
}

vi.mock('@/config/db', () => ({
    createDb: vi.fn(() => ({ db: mockDb }))
}))

describe('Users Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('GET /users should return list of users', async () => {
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

        const res = await router.request('/users', {
            method: 'GET',
        })

        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual(mockUsers)
        expect(mockDb.select).toHaveBeenCalled()
        expect(mockDb.from).toHaveBeenCalled()
    })
})
