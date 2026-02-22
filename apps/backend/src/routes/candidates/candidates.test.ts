import { describe, it, expect, vi, beforeEach } from 'vitest'
import router from './index'
import * as dbConfig from '@/config/db'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

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
}

vi.mock('@/config/db', () => ({
    createDb: vi.fn(() => ({ db: mockDb }))
}))

describe('Candidates Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('POST /candidates', () => {
        it('should create a new candidate', async () => {
            const testAccountId = 'test-account-id'
            const testCandidateId = 'test-candidate-id'
            
            // Mock account exists
            mockDb.get
                .mockResolvedValueOnce({ id: testAccountId }) // Account check
                .mockResolvedValueOnce(null) // Existing candidate check (none)
            
            // Mock candidate creation
            mockDb.run.mockResolvedValue(undefined)

            const res = await router.request('/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: 'John Doe',
                    accountId: testAccountId,
                    position: 'President',
                    manifesto: 'I will make things better'
                })
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY)
            expect(body.candidate.fullName).toBe('John Doe')
            expect(body.candidate.position).toBe('President')
        })

        it('should return conflict if candidate already exists for account and position', async () => {
            const testAccountId = 'test-account-id'
            
            // Mock account exists
            mockDb.get
                .mockResolvedValueOnce({ id: testAccountId }) // Account check
                .mockResolvedValueOnce({ id: 'existing-candidate', isActive: 1 }) // Existing active candidate for same account & position
            
            const res = await router.request('/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: 'John Doe',
                    accountId: testAccountId,
                    position: 'President',
                    manifesto: 'I will make things better'
                })
            })

            expect(res.status).toBe(409)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_ALREADY_EXISTS)
        })

        it('should allow same account to be candidate for different positions', async () => {
            const testAccountId = 'test-account-id'
            const testCandidateId = 'test-candidate-id'
            
            // Mock account exists
            mockDb.get
                .mockResolvedValueOnce({ id: testAccountId }) // Account check
                .mockResolvedValueOnce(null) // No existing candidate for this position
            
            // Mock candidate creation
            mockDb.run.mockResolvedValue(undefined)

            const res = await router.request('/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: 'John Doe',
                    accountId: testAccountId,
                    position: 'Vice President', // Different position
                    manifesto: 'I will support the team'
                })
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY)
            expect(body.candidate.position).toBe('Vice President')
        })

        it('should return bad request if account does not exist', async () => {
            const testAccountId = 'non-existent-account-id'
            
            // Mock account does not exist
            mockDb.get.mockResolvedValueOnce(null)

            const res = await router.request('/candidates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: 'John Doe',
                    accountId: testAccountId,
                    position: 'President',
                    manifesto: 'I will make things better'
                })
            })

            expect(res.status).toBe(400)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.ACCOUNT_NOT_FOUND)
        })
    })

    describe('GET /candidates', () => {
        it('should list candidates with pagination', async () => {
            const mockCandidates = [
                {
                    id: '1',
                    fullName: 'John Doe',
                    accountId: 'acc1',
                    position: 'President',
                    manifesto: 'I will make things better',
                    createdAt: 1234567890,
                    updatedAt: 1234567890,
                },
                {
                    id: '2',
                    fullName: 'Jane Smith',
                    accountId: 'acc2',
                    position: 'Vice President',
                    manifesto: 'I will support the president',
                    createdAt: 1234567890,
                    updatedAt: 1234567890,
                }
            ]

            mockDb.all.mockResolvedValue(mockCandidates)
            mockDb.get.mockResolvedValue({ count: 2 })

            const res = await router.request('/candidates?page=1&limit=10', {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.data).toHaveLength(2)
            expect(body.meta.total).toBe(2)
            expect(body.meta.page).toBe(1)
            expect(body.meta.limit).toBe(10)
            expect(body.meta.totalPages).toBe(1)
        })

        it('GET /candidates with defaults should use page 1 and limit 10', async () => {
            const mockCandidates = [{ id: '1' }]
            mockDb.all.mockResolvedValue(mockCandidates)
            mockDb.get.mockResolvedValue({ count: 1 })

            const res = await router.request('/candidates', { method: 'GET' })

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
    })

    describe('GET /candidates/:id', () => {
        it('should get a candidate by ID', async () => {
            const testCandidateId = 'test-candidate-id'
            const mockCandidate = {
                id: testCandidateId,
                fullName: 'John Doe',
                accountId: 'acc1',
                position: 'President',
                manifesto: 'I will make things better',
                createdAt: 1234567890,
                updatedAt: 1234567890,
            }

            mockDb.get.mockResolvedValue(mockCandidate)

            const res = await router.request(`/candidates/${testCandidateId}`, {
                method: 'GET',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.id).toBe(testCandidateId)
            expect(body.fullName).toBe('John Doe')
        })

        it('should return 404 if candidate not found', async () => {
            const testCandidateId = 'non-existent-id'
            mockDb.get.mockResolvedValue(null)

            const res = await router.request(`/candidates/${testCandidateId}`, {
                method: 'GET',
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND)
        })
    })

    describe('PUT /candidates/:id', () => {
        it('should update a candidate', async () => {
            const testCandidateId = 'test-candidate-id'
            const existingCandidate = {
                id: testCandidateId,
                fullName: 'John Doe',
                accountId: 'acc1',
                position: 'President',
                manifesto: 'I will make things better',
                createdAt: 1234567890,
                updatedAt: 1234567890,
            }
            
            const updatedCandidate = {
                ...existingCandidate,
                fullName: 'John Updated',
                position: 'Updated President',
                updatedAt: expect.any(Number),
            }

            mockDb.get
                .mockResolvedValueOnce(existingCandidate) // Check if exists
                .mockResolvedValueOnce(updatedCandidate) // Get updated candidate
            mockDb.run.mockResolvedValue(undefined)

            const res = await router.request(`/candidates/${testCandidateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: 'John Updated',
                    position: 'Updated President'
                })
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY)
            expect(body.candidate.fullName).toBe('John Updated')
            expect(body.candidate.position).toBe('Updated President')
        })

        it('should return 404 if candidate not found', async () => {
            const testCandidateId = 'non-existent-id'
            mockDb.get.mockResolvedValue(null)

            const res = await router.request(`/candidates/${testCandidateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: 'John Updated'
                })
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND)
        })
    })

    describe('DELETE /candidates/:id', () => {
        it('should delete a candidate', async () => {
            const testCandidateId = 'test-candidate-id'
            const existingCandidate = {
                id: testCandidateId,
                fullName: 'John Doe',
                accountId: 'acc1',
                position: 'President',
                manifesto: 'I will make things better',
                createdAt: 1234567890,
                updatedAt: 1234567890,
            }

            mockDb.get.mockResolvedValue(existingCandidate)
            mockDb.update.mockReturnThis()
            mockDb.set.mockReturnThis()
            mockDb.run.mockResolvedValue(undefined)

            const res = await router.request(`/candidates/${testCandidateId}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(200)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY)
        })

        it('should return 404 if candidate not found', async () => {
            const testCandidateId = 'non-existent-id'
            mockDb.get.mockResolvedValue(null)

            const res = await router.request(`/candidates/${testCandidateId}`, {
                method: 'DELETE',
            })

            expect(res.status).toBe(404)
            const body = await res.json() as any
            expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND)
        })
    })
})