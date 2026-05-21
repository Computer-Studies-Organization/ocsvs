import type { Database } from './database.type'
import { and, count, desc, eq, isNull, like, or } from 'drizzle-orm'
import { accounts, users } from '@/database/schema'

export interface UserWithAccount {
  id: string
  accountId: string
  studentId: string
  firstName: string
  lastName: string
  yearLevel: string
  course: string
  hasVoted: number
  username: string
  email: string | null
  role: string
  deletedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface AdminListResult {
  data: UserWithAccount[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export const userRepo = {
  // Find user by user ID (joined with account)
  async findById(
    db: Database,
    userId: string,
  ): Promise<UserWithAccount | null> {
    return await db
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
      .get() ?? null
  },

  // Find user by account ID (used by votes, auth, profile handlers)
  async findByAccountId(
    db: Database,
    accountId: string,
  ): Promise<typeof users.$inferSelect | null> {
    return await db
      .select()
      .from(users)
      .where(eq(users.accountId, accountId))
      .get() ?? null
  },

  // Find user+account by student ID (used by auth login)
  async findByStudentId(
    db: Database,
    studentId: string,
  ): Promise<{
    id: string
    email: string | null
    username: string
    password_hash: string
    role: string
    createdAt: number
    updatedAt: number
    lastLogin: number | null
    deletedAt: number | null
  } | null> {
    return await db
      .select({
        id: accounts.id,
        email: accounts.email,
        username: accounts.username,
        password_hash: accounts.password_hash,
        role: accounts.role,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        lastLogin: accounts.lastLogin,
        deletedAt: accounts.deletedAt,
      })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .where(eq(users.studentId, studentId))
      .get() ?? null
  },

  // Admin list: paginated, filtered, with account data
  async listForAdmin(
    db: Database,
    opts: {
      page?: number
      limit?: number
      search?: string
      yearLevel?: string
      course?: string
      includeDeleted?: boolean
    } = {},
  ): Promise<AdminListResult> {
    const page = opts.page ?? 1
    const limit = opts.limit ?? 10
    const offset = (page - 1) * limit

    const conditions = []

    if (!opts.includeDeleted) {
      conditions.push(isNull(accounts.deletedAt))
    }

    if (opts.search) {
      conditions.push(
        or(
          like(users.firstName, `%${opts.search}%`),
          like(users.lastName, `%${opts.search}%`),
          like(users.studentId, `%${opts.search}%`),
          like(accounts.username, `%${opts.search}%`),
        ),
      )
    }

    if (opts.yearLevel) {
      conditions.push(eq(users.yearLevel, opts.yearLevel))
    }

    if (opts.course) {
      conditions.push(eq(users.course, opts.course))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [data, totalResult] = await Promise.all([
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

    return { data: data as UserWithAccount[], meta: { total, page, limit, totalPages } }
  },

  // Get account ID for a user (used before update/delete operations)
  async getAccountId(
    db: Database,
    userId: string,
  ): Promise<{ accountId: string } | null> {
    return await db
      .select({ accountId: users.accountId })
      .from(users)
      .where(eq(users.id, userId))
      .get() ?? null
  },

  // Get account with deletedAt status (used by delete/restore)
  async getAccountDeleteStatus(
    db: Database,
    userId: string,
  ): Promise<{ accountId: string, deletedAt: number | null } | null> {
    return await db
      .select({
        accountId: users.accountId,
        deletedAt: accounts.deletedAt,
      })
      .from(users)
      .innerJoin(accounts, eq(users.accountId, accounts.id))
      .where(eq(users.id, userId))
      .get() ?? null
  },

  // Update user profile fields
  async updateUser(
    db: Database,
    userId: string,
    data: Partial<{
      firstName: string
      lastName: string
      yearLevel: string
      course: string
    }>,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    await db
      .update(users)
      .set({ ...data, updatedAt: now })
      .where(eq(users.id, userId))
      .run()
  },

  // Update hasVoted flag
  async setHasVoted(
    db: Database,
    userId: string,
    hasVoted: boolean,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    await db
      .update(users)
      .set({ hasVoted: hasVoted ? 1 : 0, updatedAt: now })
      .where(eq(users.id, userId))
      .run()
  },

  // Get profile (account + user fields, used by profile handler)
  async getProfile(
    db: Database,
    accountId: string,
  ): Promise<{
    id: string
    username: string
    email: string | null
    role: string
    studentId: string
    firstName: string
    lastName: string
    yearLevel: string
    course: string
  } | null> {
    return await db
      .select({
        id: accounts.id,
        username: accounts.username,
        email: accounts.email,
        role: accounts.role,
        studentId: users.studentId,
        firstName: users.firstName,
        lastName: users.lastName,
        yearLevel: users.yearLevel,
        course: users.course,
      })
      .from(accounts)
      .innerJoin(users, eq(users.accountId, accounts.id))
      .where(eq(accounts.id, accountId))
      .get() ?? null
  },
}
