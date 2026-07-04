import type { Database, DbClient } from "./database.type";
import { and, eq, or, sql } from "drizzle-orm";
import { accounts, sessions, users } from "@/database/schema";

export const accountRepo = {
  // Check if account exists by username or email (used by auth register)
  async accountExists(
    db: Database,
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

  // Check if username exists (excluding a specific account)
  async usernameExists(db: Database, username: string, excludeAccountId: string): Promise<boolean> {
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.username, username), sql`${accounts.id} != ${excludeAccountId}`))
      .get();
    return existing != null;
  },

  // Create account + user (used by auth register)
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
    },
  ): Promise<void> {
    await db.batch([
      db.insert(accounts).values({
        id: data.accountId,
        username: data.username,
        email: data.email,
        password_hash: data.passwordHash,
        role: "user",
      }),
      db.insert(users).values({
        id: crypto.randomUUID(),
        accountId: data.accountId,
        studentId: data.studentId,
        firstName: data.firstName,
        lastName: data.lastName,
        course: data.course,
        yearLevel: data.yearLevel,
      }),
    ]);
  },

  // Update account fields
  async updateAccount(
    db: Database,
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

  // Update password hash (used by changePassword)
  async updatePassword(db: Database, accountId: string, passwordHash: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(accounts)
      .set({ password_hash: passwordHash, updatedAt: now })
      .where(eq(accounts.id, accountId))
      .run();
  },

  // Atomically invalidate all sessions and update the password hash.
  // Wraps both writes in a single libSQL batch (implicit transaction): either
  // both apply or neither does, closing the window where sessions could be
  // deleted while the password remains unchanged (and vice versa).
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

  // Get password hash for account (used by auth changePassword)
  async getPasswordHash(
    db: Database,
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

  // Soft delete account
  async softDelete(db: Database, accountId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(accounts)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(accounts.id, accountId))
      .run();
  },

  // Count active (non-deleted) admin accounts
  async countActiveAdmins(db: Database): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(and(eq(accounts.role, "admin"), sql`${accounts.deletedAt} IS NULL`))
      .get();
    return result?.count ?? 0;
  },

  // Restore soft-deleted account
  async restore(db: Database, accountId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(accounts)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(accounts.id, accountId))
      .run();
  },

  // Hard delete account: deletes sessions, users, then accounts
  // Note: votes.user_id is SET NULL via FK constraint (preserves votes)
  async hardDelete(db: DbClient, accountId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.accountId, accountId));
    await db.delete(users).where(eq(users.accountId, accountId));
    await db.delete(accounts).where(eq(accounts.id, accountId));
  },

  // Count active admin and super_admin accounts
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
};
