import { createRoute, z } from '@hono/zod-openapi'
import jsonContent, { jsonContentRequired } from '@/middleware/utils/json-content'
import * as httpStatusCodes from '@/openapi/http-status-codes'

const UpdateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  username: z.string().min(3).max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

const ProfileResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  role: z.string(),
  studentId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  yearLevel: z.string(),
  course: z.string(),
})

export const getMyProfileRoute = createRoute({
  tags: ['Profile'],
  method: 'get',
  path: '/me/profile',
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      ProfileResponseSchema,
      'Current user profile',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Unauthorized',
    ),
  },
})

export const updateMyProfileRoute = createRoute({
  tags: ['Profile'],
  method: 'patch',
  path: '/me/profile',
  request: {
    body: jsonContentRequired(
      UpdateProfileSchema,
      'Profile update data',
    ),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        profile: ProfileResponseSchema,
      }),
      'Profile updated successfully',
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Invalid request or profanity detected',
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Username already exists',
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Unauthorized',
    ),
  },
})

export const changePasswordRoute = createRoute({
  tags: ['Profile'],
  method: 'post',
  path: '/me/password',
  request: {
    body: jsonContentRequired(
      ChangePasswordSchema,
      'Password change data',
    ),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
      }),
      'Password changed successfully',
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
      'Unauthorized or incorrect current password',
    ),
  },
})
