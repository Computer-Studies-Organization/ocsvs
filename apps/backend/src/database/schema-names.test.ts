import { describe, expect, it } from 'vitest'
import { z } from '@hono/zod-openapi'
import { DbSelectUserSchema } from './schema'
import { UserApiSchema } from './openapi-schemas'

describe('user schema exports', () => {
  it('uses distinct names for database and API user schemas', () => {
    expect(DbSelectUserSchema).toBeDefined()
    expect(UserApiSchema).toBeDefined()
  })

  it('keeps integer storage in the database schema and boolean shape in the API schema', () => {
    const baseUser = {
      createdAt: 1,
      updatedAt: 1,
      id: 'user-1',
      accountId: 'account-1',
      studentId: '2023-12345',
      firstName: 'John',
      lastName: 'Doe',
      yearLevel: '3rd Year',
      course: 'BSCS',
    }

    expect(DbSelectUserSchema.parse({ ...baseUser, hasVoted: 1 }).hasVoted).toBe(1)
    expect(() => DbSelectUserSchema.parse({ ...baseUser, hasVoted: true })).toThrow()

    expect(UserApiSchema.parse({ ...baseUser, hasVoted: true }).hasVoted).toBe(true)
    expect(() => UserApiSchema.parse({ ...baseUser, hasVoted: 1 })).toThrow()
  })

  it('produces an OpenAPI-capable zod schema for API routes', () => {
    expect(UserApiSchema).toBeInstanceOf(z.ZodObject)
  })
})
