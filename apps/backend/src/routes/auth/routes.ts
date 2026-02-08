import jsonContent from "@/middleware/utils/json-content";
import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from '@/openapi/http-status-codes'

export const registerSchema = z.object({
    firstName: z.string().min(3),
    lastName: z.string().min(2),
    email: z.string().email(),
    username: z.string().min(3).max(20),
    password: z.string().min(8),
    studentId: z.string().length(18),
    course: z.enum(['BSCS', 'BSIT']),
    yearLevel: z.enum(['1st Year', '2nd Year', '3rd Year', '4th Year']),
})

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
})

export const registerRoute = createRoute({
    tags: ['Auth'],
    method: 'post',
    path: '/register',
    request: {
        body: jsonContent(
            registerSchema,
            'User registration details'
        )
    },
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            z.object({
                message: z.string(),
                user: z.object({
                    id: z.string(),
                    email: z.string(),
                    username: z.string(),
                    role: z.string(),
                    studentId: z.string(),
                }).optional()
            }),
            'User registered successfully',
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

export const loginRoute = createRoute({
    tags: ['Auth'],
    method: 'post',
    path: '/login',
    request: {
        body: jsonContent(
            loginSchema,
            'User login credentials'
        )
    },
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            z.object({
                message: z.string(),
                user: z.object({
                    id: z.string(),
                    email: z.string(),
                    username: z.string(),
                    role: z.string(),
                }),
            }),
            'User logged in successfully (session cookie set)',
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
        [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'Internal server error',
        ),
    },
})

export const logoutRoute = createRoute({
    tags: ['Auth'],
    method: 'post',
    path: '/logout',
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'User logged out successfully',
        ),
        [httpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'Unauthorized - no active session',
        ),
    },
})

export const meRoute = createRoute({
    tags: ['Auth'],
    method: 'get',
    path: '/me',
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            z.object({
                user: z.object({
                    id: z.string(),
                    email: z.string(),
                    username: z.string(),
                    role: z.string(),
                }),
            }),
            'Current authenticated user',
        ),
        [httpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'Unauthorized - no active session',
        ),
    },
})