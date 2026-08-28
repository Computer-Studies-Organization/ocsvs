import type { DbClient } from "./database.type";
import { and, eq, gte, lt } from "drizzle-orm";
import { loginAttempts } from "@/database/schema";

export type LoginAttemptRow = typeof loginAttempts.$inferSelect;

export const loginAttemptRepo = {
  async getRecentAttempts(
    db: DbClient,
    identifier: string,
    ipAddress: string,
    windowSeconds: number,
  ): Promise<Pick<LoginAttemptRow, "attemptedAt">[]> {
    const threshold = Math.floor(Date.now() / 1000) - windowSeconds;
    return await db
      .select({ attemptedAt: loginAttempts.attemptedAt })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.identifier, identifier),
          eq(loginAttempts.ipAddress, ipAddress),
          gte(loginAttempts.attemptedAt, threshold),
        ),
      )
      .orderBy(loginAttempts.attemptedAt)
      .all();
  },

  async recordAttempt(db: DbClient, identifier: string, ipAddress: string | null): Promise<void> {
    await db
      .insert(loginAttempts)
      .values({
        id: crypto.randomUUID(),
        identifier,
        attemptedAt: Math.floor(Date.now() / 1000),
        ipAddress,
      })
      .run();
  },

  async clearAttempts(db: DbClient, identifier: string): Promise<void> {
    await db.delete(loginAttempts).where(eq(loginAttempts.identifier, identifier)).run();
  },

  async deleteExpiredAttempts(
    db: DbClient,
    identifier: string,
    windowSeconds: number,
  ): Promise<void> {
    const threshold = Math.floor(Date.now() / 1000) - windowSeconds;
    await db
      .delete(loginAttempts)
      .where(
        // lt: delete rows whose timestamp is BEFORE the window cutoff (expired attempts).
        and(eq(loginAttempts.identifier, identifier), lt(loginAttempts.attemptedAt, threshold)),
      )
      .run();
  },

  async deleteAllExpiredAttempts(db: DbClient, windowSeconds: number): Promise<void> {
    const threshold = Math.floor(Date.now() / 1000) - windowSeconds;
    await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, threshold)).run();
  },
};
