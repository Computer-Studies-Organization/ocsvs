import { SelectCandidateSchema, SelectVoteSchema, SelectUserSchema } from "@/database/openapi-schemas";
import jsonContent, { jsonContentRequired } from "@/middleware/utils/json-content";
import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from '@/openapi/http-status-codes'
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export const submitVoteSchema = z.object({
    votes: z.array(z.object({
        candidateId: z.string(),
    })).min(1),
})

export const VoteItemSchema = z.object({
    candidateId: z.string(),
})

export const VoteResponseSchema = z.object({
    id: z.string(),
    userId: z.string(),
    candidateId: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
})

export const SubmitVoteResponseSchema = z.object({
    message: z.string(),
    votes: z.array(VoteResponseSchema),
})

export const VoteStatusSchema = z.object({
    hasVoted: z.boolean(),
    votes: z.array(VoteResponseSchema),
})

export const VoteCountSchema = z.object({
    candidateId: z.string(),
    candidateName: z.string(),
    position: z.string(),
    voteCount: z.number().int(),
})

export const VoteResultsSchema = z.object({
    position: z.string(),
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
    path: "/votes",
    request: {
        body: jsonContentRequired(
            submitVoteSchema,
            'Vote submission details - array of candidates (one per position)'
        )
    },
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            SubmitVoteResponseSchema,
            ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY
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

export const getMyVoteStatusRoute = createRoute({
    tags: ['Votes'],
    method: 'get',
    path: '/votes/me',
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            VoteStatusSchema,
            'User vote status'
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
            'Election results grouped by position'
        ),
        [httpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({
                message: z.string(),
            }),
            ERROR_MESSAGES.UNAUTHORIZED,
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
            'Vote count for candidate'
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
    },
})

export const withdrawVoteRoute = createRoute({
    tags: ['Votes'],
    method: 'delete',
    path: '/votes/me',
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            z.object({
                message: z.string(),
            }),
            ERROR_MESSAGES.VOTE_WITHDRAWN_SUCCESSFULLY
        ),
        [httpStatusCodes.BAD_REQUEST]: jsonContent(
            z.object({
                message: z.string(),
            }),
            ERROR_MESSAGES.USER_NOT_FOUND,
        ),
        [httpStatusCodes.NOT_FOUND]: jsonContent(
            z.object({
                message: z.string(),
            }),
            ERROR_MESSAGES.VOTE_NOT_FOUND,
        ),
        [httpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({
                message: z.string(),
            }),
            ERROR_MESSAGES.UNAUTHORIZED,
        ),
        [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
            z.object({
                message: z.string(),
            }),
            ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
        ),
    },
})
