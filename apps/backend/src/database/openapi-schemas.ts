import { z } from '@hono/zod-openapi'

// OpenAPI-compatible schemas for documentation
// These schemas mirror the database structure but use @hono/zod-openapi's z
// which includes OpenAPI metadata support

export const UserSchema = z.object({
  createdAt: z.number().int().openapi({
    description: 'Creation timestamp',
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: 'Last update timestamp',
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: 'User ID',
    example: 'user_123abc',
  }),
  accountId: z.string().openapi({
    description: 'Associated account ID',
    example: 'acc_456def',
  }),
  studentId: z.string().openapi({
    description: 'Student ID number',
    example: '2023-12345',
  }),
  firstName: z.string().openapi({
    description: 'First name',
    example: 'John',
  }),
  lastName: z.string().openapi({
    description: 'Last name',
    example: 'Doe',
  }),
  yearLevel: z.string().openapi({
    description: 'Year level',
    example: '3rd Year',
  }),
  course: z.string().openapi({
    description: 'Course/Program',
    example: 'BS Computer Science',
  }),
  hasVoted: z.boolean().openapi({
    description: 'Whether the user has voted',
    example: false,
  }),
})

export const AccountSchema = z.object({
  createdAt: z.number().int().openapi({
    description: 'Creation timestamp',
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: 'Last update timestamp',
    example: 1738000000,
  }),
  lastLogin: z.number().int().openapi({
    description: 'Last login timestamp',
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: 'Account ID',
    example: 'acc_456def',
  }),
  role: z.string().openapi({
    description: 'User role (admin, user, etc.)',
    example: 'user',
  }),
  username: z.string().openapi({
    description: 'Username',
    example: 'johndoe',
  }),
  email: z.string().email().openapi({
    description: 'Email address',
    example: 'john.doe@example.com',
  }),
  passwordHash: z.string().openapi({
    description: 'Password hash (not exposed in API responses)',
    example: 'hash_abc123',
  }),
})

export const SessionSchema = z.object({
  id: z.string().openapi({
    description: 'Session ID',
    example: 'sess_789ghi',
  }),
  accountId: z.string().openapi({
    description: 'Associated account ID',
    example: 'acc_456def',
  }),
  expiresAt: z.number().int().openapi({
    description: 'Session expiration timestamp',
    example: 1738086400,
  }),
  createdAt: z.number().int().openapi({
    description: 'Creation timestamp',
    example: 1738000000,
  }),
})

export const CandidateSchema = z.object({
  createdAt: z.number().int().openapi({
    description: 'Creation timestamp',
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: 'Last update timestamp',
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: 'Candidate ID',
    example: 'cand_101jkl',
  }),
  fullName: z.string().openapi({
    description: 'Full name of the candidate',
    example: 'Jane Smith',
  }),
  accountId: z.string().openapi({
    description: 'Associated account ID',
    example: 'acc_456def',
  }),
  position: z.string().openapi({
    description: 'Position running for',
    example: 'President',
  }),
  manifesto: z.string().openapi({
    description: 'Candidate manifesto or platform',
    example: 'I promise to improve student services...',
  }),
  isActive: z.number().int().openapi({
    description: 'Whether the candidate is active (0 or 1)',
    example: 1,
  }),
})

export const VoteSchema = z.object({
  createdAt: z.number().int().openapi({
    description: 'Creation timestamp',
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: 'Last update timestamp',
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: 'Vote ID',
    example: 'vote_201mno',
  }),
  userId: z.string().openapi({
    description: 'User who cast the vote',
    example: 'user_123abc',
  }),
  candidateId: z.string().openapi({
    description: 'Candidate who received the vote',
    example: 'cand_101jkl',
  }),
  position: z.string().openapi({
    description: 'Candidate position at vote time',
    example: 'President',
  }),
})

// Type aliases for convenience - use these in route definitions
export const SelectUserSchema = UserSchema
export const SelectAccountSchema = AccountSchema
export const SelectSessionSchema = SessionSchema
export const SelectCandidateSchema = CandidateSchema
export const SelectVoteSchema = VoteSchema
