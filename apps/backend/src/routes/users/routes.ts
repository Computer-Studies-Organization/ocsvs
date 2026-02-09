import { SelectUserSchema } from "@/database/schema";
import jsonContent from "@/middleware/utils/json-content";
import { createRoute, z } from "@hono/zod-openapi";
import * as httpStatusCodes from '@/openapi/http-status-codes'



export const listUsersRoute = createRoute({
    tags: ['Users'],
    method: 'get',
    path: '/users',
    responses: {
        [httpStatusCodes.OK]: jsonContent(
            z.array(SelectUserSchema as any),
            'List of users',
        ),
        [httpStatusCodes.UNAUTHORIZED]: jsonContent(
            z.object({
                message: z.string(),
            }),
            'Unauthorized',
        ),
    },
})