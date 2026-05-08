import type { AppRouteHandler } from '@/lib/types/app-types'
import type { deleteUserRoute, getUserRoute, listUsersRoute, restoreUserRoute, updateUserRoute } from '@/routes/users/routes'
import { and, count, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import { createDb } from '@/config/db'
import { accounts, users } from '@/database/schema'

import * as httpStatusCodes from '@/openapi/http-status-codes'

export const listUsers: AppRouteHandler<typeof listUsersRoute> = async (c) => {
  const { db } = createDb(c)
  const { page, limit, search, yearLevel, course, includeDeleted } = c.req.valid('query')

  const offset = (page - 1) * limit

  const conditions = []

  // Filter out deleted users by default
  if (!includeDeleted) {
    conditions.push(isNull(accounts.deletedAt))
  }

  // Search filter
  if (search) {
    conditions.push(
      or(
        like(users.firstName, `%${search}%`),
        like(users.lastName, `%${search}%`),
        like(users.studentId, `%${search}%`),
        like(accounts.username, `%${search}%`),
      ),
    )
  }

  // Year level filter
  if (yearLevel) {
    conditions.push(eq(users.yearLevel, yearLevel))
  }

  // Course filter
  if (course) {
    conditions.push(eq(users.course, course))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [usersResult, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        accountId: users.accountId,
        studentId: users.studentId,
        firstName: users.firstName,
        lastName: users.lastName,
        yearLevel: users.yearLevel,
        course: users.course,
        hasVoted: users.hasVoted,
        username: accounts.username,
        email: accounts.email,
        role: accounts.role,
        deletedAt: accounts.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .where(whereClause)
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: count() })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .where(whereClause)
      .get(),
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

export const getUser: AppRouteHandler<typeof getUserRoute> = async (c) => {
  const { db } = createDb(c)
  const { userId } = c.req.valid('param')

  const user = await db
    .select({
      id: users.id,
      accountId: users.accountId,
      studentId: users.studentId,
      firstName: users.firstName,
      lastName: users.lastName,
      yearLevel: users.yearLevel,
      course: users.course,
      hasVoted: users.hasVoted,
      username: accounts.username,
      email: accounts.email,
      role: accounts.role,
      deletedAt: accounts.deletedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLogin: accounts.lastLogin,
    })
    .from(users)
    .innerJoin(accounts, eq(users.accountId, accounts.id))
    .where(eq(users.id, userId))
    .get()

  if (!user) {
    return c.json(
      { message: 'User not found' },
      httpStatusCodes.NOT_FOUND,
    )
  }

  return c.json(
    {
      ...user,
      hasVoted: user.hasVoted === 1,
    },
    httpStatusCodes.OK,
  )
}

export const updateUser: AppRouteHandler<typeof updateUserRoute> = async (c) => {
  const { db } = createDb(c)
  const { userId } = c.req.valid('param')
  const updateData = c.req.valid('json')

  // Get user's accountId
  const user = await db
    .select({ accountId: users.accountId })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!user) {
    return c.json(
      { message: 'User not found' },
      httpStatusCodes.NOT_FOUND,
    )
  }

  // Check for duplicate username if updating
  if (updateData.username) {
    const existing = await db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.username, updateData.username),
        sql`${accounts.id} != ${user.accountId}`,
      ))
      .get()

    if (existing) {
      return c.json(
        { message: 'Username already exists' },
        httpStatusCodes.CONFLICT,
      )
    }
  }

  // Update accounts table if account fields present
  const accountFields: any = {}
  if (updateData.username !== undefined)
    accountFields.username = updateData.username
  if (updateData.email !== undefined)
    accountFields.email = updateData.email

  if (Object.keys(accountFields).length > 0) {
    accountFields.updatedAt = sql`CURRENT_TIMESTAMP`
    await db
      .update(accounts)
      .set(accountFields)
      .where(eq(accounts.id, user.accountId))
      .run()
  }

  // Update users table if profile fields present
  const userFields: any = {}
  if (updateData.firstName !== undefined)
    userFields.firstName = updateData.firstName
  if (updateData.lastName !== undefined)
    userFields.lastName = updateData.lastName
  if (updateData.yearLevel !== undefined)
    userFields.yearLevel = updateData.yearLevel
  if (updateData.course !== undefined)
    userFields.course = updateData.course

  if (Object.keys(userFields).length > 0) {
    userFields.updatedAt = sql`CURRENT_TIMESTAMP`
    await db
      .update(users)
      .set(userFields)
      .where(eq(users.id, userId))
      .run()
  }

  // Fetch updated user
  const updatedUser = await db
    .select({
      id: users.id,
      accountId: users.accountId,
      studentId: users.studentId,
      firstName: users.firstName,
      lastName: users.lastName,
      yearLevel: users.yearLevel,
      course: users.course,
      hasVoted: users.hasVoted,
      username: accounts.username,
      email: accounts.email,
      role: accounts.role,
      deletedAt: accounts.deletedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(accounts, eq(users.accountId, accounts.id))
    .where(eq(users.id, userId))
    .get()

  return c.json(
    {
      message: 'User updated successfully',
      user: {
        ...updatedUser!,
        hasVoted: updatedUser!.hasVoted === 1,
      },
    },
    httpStatusCodes.OK,
  )
}

export const deleteUser: AppRouteHandler<typeof deleteUserRoute> = async (c) => {
  const { db } = createDb(c)
  const { userId } = c.req.valid('param')

  // Get user's accountId and check if already deleted
  const user = await db
    .select({
      accountId: users.accountId,
      deletedAt: accounts.deletedAt,
    })
    .from(users)
    .innerJoin(accounts, eq(users.accountId, accounts.id))
    .where(eq(users.id, userId))
    .get()

  if (!user) {
    return c.json(
      { message: 'User not found' },
      httpStatusCodes.NOT_FOUND,
    )
  }

  if (user.deletedAt !== null) {
    return c.json(
      { message: 'User is already archived' },
      httpStatusCodes.BAD_REQUEST,
    )
  }

  // Soft delete: set deletedAt timestamp
  await db
    .update(accounts)
    .set({
      deletedAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(accounts.id, user.accountId))
    .run()

  return c.json(
    { message: 'User archived successfully' },
    httpStatusCodes.OK,
  )
}

export const restoreUser: AppRouteHandler<typeof restoreUserRoute> = async (c) => {
  const { db } = createDb(c)
  const { userId } = c.req.valid('param')

  // Get user's accountId and check if deleted
  const user = await db
    .select({
      accountId: users.accountId,
      deletedAt: accounts.deletedAt,
    })
    .from(users)
    .innerJoin(accounts, eq(users.accountId, accounts.id))
    .where(eq(users.id, userId))
    .get()

  if (!user) {
    return c.json(
      { message: 'User not found' },
      httpStatusCodes.NOT_FOUND,
    )
  }

  if (user.deletedAt === null) {
    return c.json(
      { message: 'User is not archived' },
      httpStatusCodes.BAD_REQUEST,
    )
  }

  // Restore: clear deletedAt
  await db
    .update(accounts)
    .set({
      deletedAt: null,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(accounts.id, user.accountId))
    .run()

  return c.json(
    { message: 'User restored successfully' },
    httpStatusCodes.OK,
  )
}
