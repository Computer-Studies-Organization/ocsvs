import type { Database } from '../repositories/database.type'
import { and, count, desc, eq, isNull, like, or } from 'drizzle-orm'
import { accounts, users } from '@/database/schema'

// --- Context-specific return types ---

/** Auth: includes password_hash for credential verification */
export interface AuthView {
  id: string
  email: string | null
  username: string
  password_hash: string
  role: string
  createdAt: number
  updatedAt: number
  lastLogin: number | null
  deletedAt: number | null
}

/** Profile: display-safe, no password_hash */
export interface ProfileView {
  id: string
  username: string
  email: string | null
  role: string
  studentId: string
  firstName: string
  lastName: string
  yearLevel: string
  course: string
}

/** Admin: full user view (voting status is derived from `votes` — not stored on the user row) */
export interface AdminView {
  id: string
  accountId: string
  studentId: string
  firstName: string
  lastName: string
  yearLevel: string
  course: string
  username: string
  email: string | null
  role: string
  deletedAt: number | null
  createdAt: number
  updatedAt: number
  lastLogin: number | null
}

export interface AdminListResult {
  data: AdminView[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface DeleteStatus {
  accountId: string
  deletedAt: number | null
}

// --- Query module ---

export const userAccountQueries = {
  /** Find user by user ID — joined with account */
  async findById(
    db: Database,
    userId: string,
  ): Promise<AdminView | null> {
    const row = await db
      .select({
        id: users.id,
        accountId: users.accountId,
        studentId: users.studentId,
        firstName: users.firstName,
        lastName: users.lastName,
        yearLevel: users.yearLevel,
        course: users.course,
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

    return row ?? null
  },

  /** Find by student ID — returns auth fields including password_hash */
  async findByStudentId(
    db: Database,
    studentId: string,
  ): Promise<AuthView | null> {
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

  /** Admin list: paginated, filtered. Voting status is not part of the user row. */
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

    return {
      data,
      meta: { total, page, limit, totalPages },
    }
  },

  /** Profile view — display-safe, no password_hash */
  async getProfile(
    db: Database,
    accountId: string,
  ): Promise<ProfileView | null> {
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

  /** Account delete status — used by delete/restore operations */
  async getAccountDeleteStatus(
    db: Database,
    userId: string,
  ): Promise<DeleteStatus | null> {
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
}
