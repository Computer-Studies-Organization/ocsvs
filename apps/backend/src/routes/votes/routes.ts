import { createRoute, z } from '@hono/zod-openapi'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import jsonContent, { jsonContentRequired } from '@/middleware/utils/json-content'
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const submitVoteSchema = z.object({
  electionId: z.string().openapi({
    description: 'Election the votes are cast in',
    example: 'elec_202mno',
  }),
  votes: z.array(z.object({
    candidateId: z.string(),
    positionId: z.string(),
  })).min(1),
})

export const VoteItemSchema = z.object({
  candidateId: z.string(),
  positionId: z.string(),
})

export const VoteResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  candidateId: z.string(),
  positionId: z.string(),
  electionId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const SubmitVoteResponseSchema = z.object({
  message: z.string(),
  votes: z.array(VoteResponseSchema),
})

/** Response for /votes/me: the voter's picks for the current open election. */
export const VoteStatusSchema = z.object({
  electionId: z.string().nullable().openapi({
    description: 'Current open election ID, or null if none is open',
    example: 'elec_202mno',
  }),
  votes: z.array(z.object({
    candidateId: z.string(),
    positionId: z.string(),
  })),
})

export const VoteCountSchema = z.object({
  candidateId: z.string(),
  candidateName: z.string(),
  positionId: z.string(),
  positionName: z.string(),
  voteCount: z.number().int(),
})

export const VoteResultsSchema = z.object({
  positionId: z.string(),
  positionName: z.string(),
  candidates: z.array(VoteCountSchema),
})

export const VoteResultsResponseSchema = z.object({
  results: z.array(VoteResultsSchema),
  meta: z.object({
    totalVotes: z.number().int(),
    totalPositions: z.number().int(),
  }),
})

export const submitVoteRoute = createRoute({
  tags: ['Votes'],
  method: 'post',
  path: '/votes',
  request: {
    body: jsonContentRequired(
      submitVoteSchema,
      'Vote submission details - array of candidates (one per position)',
    ),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      SubmitVoteResponseSchema,
      ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY,
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INVALID_REQUEST,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.VOTE_ALREADY_CAST,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.DUPLICATE_POSITION_VOTE,
    ),
    [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    ),
  },
})

export const getMyVotesRoute = createRoute({
  tags: ['Votes'],
  method: 'get',
  path: '/votes/me',
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      VoteStatusSchema,
      'My votes for the current open election',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
  },
})

export const getVoteResultsRoute = createRoute({
  tags: ['Votes'],
  method: 'get',
  path: '/votes/results',
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      VoteResultsResponseSchema,
      'Election results grouped by position',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
  },
})

export const getCandidateVoteCountRoute = createRoute({
  tags: ['Votes'],
  method: 'get',
  path: '/votes/candidates/{id}/count',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      VoteCountSchema,
      'Vote count for candidate',
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
  },
})
