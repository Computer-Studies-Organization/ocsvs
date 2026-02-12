import jsonContent, { jsonContentRequired } from "@/middleware/utils/json-content";
import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from '@/openapi/http-status-codes'


export const createCandidateSchema = z.object({
    fullName: z.string(),
    accountId: z.string().uuid(),
    position: z.string(),
    manifesto: z.string(),
})

export const createCandidateRoute = createRoute({
    tags: ['Candidates'],
    method: 'post',
    path: "/candidates",
    request: {
        body: jsonContent(
            createCandidateSchema,
            'Candidate details'
        )
    },
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            z.object({
                message: z.string(),
                candidate: z.object({
                    id: z.string(),
                    fullName: z.string(),
                    accountId: z.string(),
                    position: z.string(),
                    manifesto: z.string(),
                })
            }), 
            'Candidate created successfully!'
        ),
         [httpStatusCodes.BAD_REQUEST]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'Invalid request',
        ),
        [httpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'Unauthorized',
        ),
        [httpStatusCodes.CONFLICT]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'User already exists',
        ),
        [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'Internal server error',
        ),
    },
})