import { z } from '@hono/zod-openapi'

// OpenAPI-compatible schemas for documentation
// These schemas mirror the database structure but use @hono/zod-openapi's z
// which includes OpenAPI metadata support

export const UserApiSchema = z.object({
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
  positionId: z.string().openapi({
    description: 'Position (FK into positions.id) the candidate is running for',
    example: 'pos_101jkl',
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
  positionId: z.string().openapi({
    description: 'Position (FK into positions.id) the vote was cast for',
    example: 'pos_101jkl',
  }),
  electionId: z.string().openapi({
    description: 'Election (FK into elections.id) the vote was cast in',
    example: 'elec_202mno',
  }),
})

// Type aliases for convenience - use these in route definitions
export const UserOpenApiSchema = UserApiSchema
export const SelectAccountSchema = AccountSchema
export const SelectSessionSchema = SessionSchema
export const SelectCandidateSchema = CandidateSchema
export const SelectVoteSchema = VoteSchema

// Election schemas
export const ElectionSchema = z.object({
  createdAt: z.number().int().openapi({
    description: 'Creation timestamp',
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: 'Last update timestamp',
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: 'Election ID',
    example: 'elec_202mno',
  }),
  name: z.string().openapi({
    description: 'Election name',
    example: 'CSO General Elections 2026',
  }),
  description: z.string().nullable().openapi({
    description: 'Election description',
    example: 'Annual student council elections',
  }),
  status: z.string().openapi({
    description: 'Election lifecycle status (draft, open, closed, archived)',
    example: 'draft',
  }),
  opensAt: z.number().int().nullable().openapi({
    description: 'Election opens at (Unix seconds)',
    example: 1738000000,
  }),
  closesAt: z.number().int().nullable().openapi({
    description: 'Election closes at (Unix seconds)',
    example: 1738604800,
  }),
})

export const PositionSchema = z.object({
  createdAt: z.number().int().openapi({
    description: 'Creation timestamp',
    example: 1738000000,
  }),
  updatedAt: z.number().int().openapi({
    description: 'Last update timestamp',
    example: 1738000000,
  }),
  id: z.string().openapi({
    description: 'Position ID',
    example: 'pos_303pqr',
  }),
  electionId: z.string().openapi({
    description: 'Election ID this position belongs to',
    example: 'elec_202mno',
  }),
  name: z.string().openapi({
    description: 'Position name',
    example: 'President',
  }),
  displayOrder: z.number().int().openapi({
    description: 'Display order for the position',
    example: 0,
  }),
})

export const CreateElectionBodySchema = z.object({
  name: z.string().min(1).max(200).openapi({
    description: 'Election name',
    example: 'CSO General Elections 2026',
  }),
  description: z.string().optional().openapi({
    description: 'Election description',
    example: 'Annual student council elections',
  }),
  opensAt: z.number().int().optional().openapi({
    description: 'Election opens at (Unix seconds)',
    example: 1738000000,
  }),
  closesAt: z.number().int().optional().openapi({
    description: 'Election closes at (Unix seconds)',
    example: 1738604800,
  }),
}).openapi('CreateElectionBody')

export const UpdateElectionBodySchema = z.object({
  name: z.string().min(1).max(200).optional().openapi({
    description: 'Election name',
    example: 'CSO General Elections 2026',
  }),
  description: z.string().nullable().optional().openapi({
    description: 'Election description',
    example: 'Annual student council elections',
  }),
  opensAt: z.number().int().nullable().optional().openapi({
    description: 'Election opens at (Unix seconds)',
    example: 1738000000,
  }),
  closesAt: z.number().int().nullable().optional().openapi({
    description: 'Election closes at (Unix seconds)',
    example: 1738604800,
  }),
}).openapi('UpdateElectionBody')

export const TransitionBodySchema = z.object({
  to: z.enum(['draft', 'open', 'closed', 'archived']).openapi({
    description: 'Target status',
    example: 'open',
  }),
  opensAt: z.number().int().optional().openapi({
    description: 'Election opens at (Unix seconds)',
    example: 1738000000,
  }),
  closesAt: z.number().int().optional().openapi({
    description: 'Election closes at (Unix seconds)',
    example: 1738604800,
  }),
}).openapi('TransitionBody')

export const ListElectionsQuerySchema = z.object({
  status: z.enum(['draft', 'open', 'closed', 'archived']).optional().openapi({
    description: 'Filter by status',
    example: 'open',
  }),
}).openapi('ListElectionsQuery')

export const CreatePositionBodySchema = z.object({
  name: z.string().min(1).max(200).openapi({
    description: 'Position name',
    example: 'President',
  }),
  displayOrder: z.number().int().optional().openapi({
    description: 'Display order for the position',
    example: 0,
  }),
}).openapi('CreatePositionBody')

export const UpdatePositionBodySchema = z.object({
  name: z.string().min(1).max(200).optional().openapi({
    description: 'Position name',
    example: 'President',
  }),
  displayOrder: z.number().int().optional().openapi({
    description: 'Display order for the position',
    example: 0,
  }),
}).openapi('UpdatePositionBody')
