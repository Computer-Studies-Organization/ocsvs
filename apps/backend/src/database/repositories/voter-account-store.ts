import type { AuditLogEntry } from "./audit-log.repository";
import type { Database, DbClient } from "./database.type";
import { and, count, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { accounts, auditLog, sessions, users } from "@/database/schema";

// --- Context-specific return types ---

/** Auth: includes password_hash for credential verification */
export interface AuthView {
  id: string;
  email: string | null;
  username: string;
  password_hash: string;
  role: string;
  createdAt: number;
  updatedAt: number;
  lastLogin: number | null;
  deletedAt: number | null;
}

/** Profile: display-safe, no password_hash */
export interface ProfileView {
  id: string;
  username: string;
  email: string | null;
  role: string;
  studentId: string;
  firstName: string;
  lastName: string;
  yearLevel: string;
  course: string;
}

/** Admin: full voter account view */
export interface AdminView {
  id: string;
  accountId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  yearLevel: string;
  course: string;
  username: string;
  email: string | null;
  role: string;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  lastLogin: number | null;
}

export interface AdminListResult {
  data: AdminView[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DeleteStatus {
  accountId: string;
  deletedAt: number | null;
  role: string;
}

/**
 * VoterAccountStore: Deep module encapsulating all persistence, lookup queries,
 * and multi-table transactions spanning the `accounts` and `users` tables.
 */
export const voterAccountStore = {
  /** Check if account exists by username or email */
  async accountExists(
    db: DbClient,
    username: string,
    email?: string | null,
  ): Promise<{ id: string } | null> {
    const conditions = [eq(accounts.username, username)];
    if (email && email.trim()) {
      conditions.push(eq(accounts.email, email));
    }
    return (
      (await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(or(...conditions))
        .get()) ?? null
    );
  },

  /** Check if username exists (excluding a specific account ID) */
  async usernameExists(db: DbClient, username: string, excludeAccountId: string): Promise<boolean> {
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.username, username), sql`${accounts.id} != ${excludeAccountId}`))
      .get();
    return existing != null;
  },

  /** Create account + user atomically */
  async create(
    db: Database,
    data: {
      accountId: string;
      username: string;
      email: string | null;
      passwordHash: string;
      studentId: string;
      firstName: string;
      lastName: string;
      course: string;
      yearLevel: string;
      role?: "user" | "admin" | "super_admin";
    },
    auditEntry?: AuditLogEntry,
  ): Promise<void> {
    const accountInsert = db.insert(accounts).values({
      id: data.accountId,
      username: data.username,
      email: data.email,
      password_hash: data.passwordHash,
      role: data.role || "user",
    });
    const userInsert = db.insert(users).values({
      id: crypto.randomUUID(),
      accountId: data.accountId,
      studentId: data.studentId,
      firstName: data.firstName,
      lastName: data.lastName,
      course: data.course,
      yearLevel: data.yearLevel,
    });

    if (auditEntry) {
      await db.batch([
        accountInsert,
        userInsert,
        db.insert(auditLog).values({
          id: crypto.randomUUID(),
          createdAt: Math.floor(Date.now() / 1000),
          ...auditEntry,
        }),
      ]);
      return;
    }

    await db.batch([accountInsert, userInsert]);
  },

  /** Update account fields */
  async updateAccount(
    db: DbClient,
    accountId: string,
    data: Partial<{
      username: string;
      email: string | null;
      password_hash: string;
      lastLogin: number;
    }>,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(accounts)
      .set({ ...data, updatedAt: now })
      .where(eq(accounts.id, accountId))
      .run();
  },

  /** Update user profile fields */
  async updateUser(
    db: DbClient,
    userId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      yearLevel: string;
      course: string;
    }>,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(users)
      .set({ ...data, updatedAt: now })
      .where(eq(users.id, userId))
      .run();
  },

  /** Update password hash */
  async updatePassword(db: DbClient, accountId: string, passwordHash: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(accounts)
      .set({ password_hash: passwordHash, updatedAt: now })
      .where(eq(accounts.id, accountId))
      .run();
  },

  /** Change password and invalidate sessions atomically */
  async changePasswordAndInvalidateSessions(
    db: Database,
    accountId: string,
    passwordHash: string,
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db.batch([
      db.delete(sessions).where(eq(sessions.accountId, accountId)),
      db
        .update(accounts)
        .set({ password_hash: passwordHash, updatedAt: now })
        .where(eq(accounts.id, accountId)),
    ]);
  },

  /** Get password hash for account */
  async getPasswordHash(
    db: DbClient,
    accountId: string,
  ): Promise<{ password_hash: string } | null> {
    return (
      (await db
        .select({ password_hash: accounts.password_hash })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .get()) ?? null
    );
  },

  /** Soft delete account */
  async softDelete(db: DbClient, accountId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(accounts)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(accounts.id, accountId))
      .run();
  },

  /** Restore soft-deleted account */
  async restore(db: DbClient, accountId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(accounts)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(accounts.id, accountId))
      .run();
  },

  /** Hard delete account and user records */
  async hardDelete(db: DbClient, accountId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.accountId, accountId));
    await db.delete(users).where(eq(users.accountId, accountId));
    await db.delete(accounts).where(eq(accounts.id, accountId));
  },

  /** Count active (non-deleted) admin accounts */
  async countActiveAdmins(db: DbClient): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(and(eq(accounts.role, "admin"), sql`${accounts.deletedAt} IS NULL`))
      .get();
    return result?.count ?? 0;
  },

  /** Count active admin and super_admin accounts */
  async countActiveAdminsAndSuperAdmins(db: DbClient): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(
        and(sql`${accounts.role} IN ('admin', 'super_admin')`, sql`${accounts.deletedAt} IS NULL`),
      )
      .get();
    return result?.count ?? 0;
  },

  /** Find user row by account ID */
  async findByAccountId(
    db: DbClient,
    accountId: string,
  ): Promise<typeof users.$inferSelect | null> {
    return (await db.select().from(users).where(eq(users.accountId, accountId)).get()) ?? null;
  },

  /** Get account ID for a user ID */
  async getAccountId(db: DbClient, userId: string): Promise<{ accountId: string } | null> {
    return (
      (await db
        .select({ accountId: users.accountId })
        .from(users)
        .where(eq(users.id, userId))
        .get()) ?? null
    );
  },

  /** Find user by user ID — joined with account */
  async findById(db: DbClient, userId: string): Promise<AdminView | null> {
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
      .get();

    return row ?? null;
  },

  /** Find by student ID — returns auth fields including password_hash */
  async findByStudentId(db: DbClient, studentId: string): Promise<AuthView | null> {
    return (
      (await db
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
        .get()) ?? null
    );
  },

  /** Admin list: paginated, filtered */
  async listForAdmin(
    db: DbClient,
    opts: {
      page?: number;
      limit?: number;
      search?: string;
      yearLevel?: string;
      course?: string;
      includeDeleted?: boolean;
    } = {},
  ): Promise<AdminListResult> {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 10;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (!opts.includeDeleted) {
      conditions.push(isNull(accounts.deletedAt));
    }

    if (opts.search) {
      conditions.push(
        or(
          like(users.firstName, `%${opts.search}%`),
          like(users.lastName, `%${opts.search}%`),
          like(users.studentId, `%${opts.search}%`),
          like(accounts.username, `%${opts.search}%`),
        ),
      );
    }

    if (opts.yearLevel) {
      conditions.push(eq(users.yearLevel, opts.yearLevel));
    }

    if (opts.course) {
      conditions.push(eq(users.course, opts.course));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
    ]);

    const total = totalResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: { total, page, limit, totalPages },
    };
  },

  /** Profile view — display-safe */
  async getProfile(db: DbClient, accountId: string): Promise<ProfileView | null> {
    return (
      (await db
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
        .get()) ?? null
    );
  },

  /** Account delete status */
  async getAccountDeleteStatus(db: DbClient, userId: string): Promise<DeleteStatus | null> {
    return (
      (await db
        .select({
          accountId: users.accountId,
          deletedAt: accounts.deletedAt,
          role: accounts.role,
        })
        .from(users)
        .innerJoin(accounts, eq(users.accountId, accounts.id))
        .where(eq(users.id, userId))
        .get()) ?? null
    );
  },
};
