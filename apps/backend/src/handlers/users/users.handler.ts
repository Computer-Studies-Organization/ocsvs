import type { AppRouteHandler } from '@/lib/types/app-types'
import type { listUsersRoute } from '@/routes/users/routes'
import { count, desc } from 'drizzle-orm'
import { createDb } from '@/config/db'
import { users } from '@/database/schema'

import * as httpStatusCodes from '@/openapi/http-status-codes'

export const listUsers: AppRouteHandler<typeof listUsersRoute> = async (c) => {
  const { db } = createDb(c)
  const { page, limit } = c.req.valid('query')

  const offset = (page - 1) * limit

  const [usersResult, totalResult] = await Promise.all([
    db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit)
      .offset(offset)
      .all(),
    db.select({ count: count() }).from(users).get(),
  ])

  const total = totalResult?.count ?? 0
  const totalPages = Math.ceil(total / limit)
  const normalizedUsers = usersResult.map(user => ({
    ...user,
    hasVoted: user.hasVoted === 1,
  }))

  return c.json(
    {
      data: normalizedUsers,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    },
    httpStatusCodes.OK,
  )
}
