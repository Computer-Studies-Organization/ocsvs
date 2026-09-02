import type { DbClient } from "./database.type";
import { and, asc, desc, eq, gte, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { elections, type TElectionStatus } from "@/database/schema";

export type ElectionRow = typeof elections.$inferSelect;

export interface ListElectionsOpts {
  status?: TElectionStatus;
}

export const electionRepo = {
  async create(
    db: DbClient,
    data: {
      name: string;
      description?: string | null;
      opensAt?: number | null;
      closesAt?: number | null;
    },
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(elections)
      .values({
        id,
        name: data.name,
        description: data.description ?? null,
        status: "draft",
        opensAt: data.opensAt ?? null,
        closesAt: data.closesAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  },

  async findById(db: DbClient, id: string): Promise<ElectionRow | null> {
    return (await db.select().from(elections).where(eq(elections.id, id)).get()) ?? null;
  },

  async list(db: DbClient, opts: ListElectionsOpts = {}): Promise<ElectionRow[]> {
    const where: SQL | undefined = opts.status ? eq(elections.status, opts.status) : undefined;
    return await db
      .select()
      .from(elections)
      .where(where)
      .orderBy(desc(elections.createdAt), desc(elections.id))
      .all();
  },

  async findOpen(db: DbClient): Promise<ElectionRow | null> {
    return (await db.select().from(elections).where(eq(elections.status, "open")).get()) ?? null;
  },

  async findCurrentlyOpen(
    db: DbClient,
    now = Math.floor(Date.now() / 1000),
  ): Promise<ElectionRow | null> {
    return (
      (await db
        .select()
        .from(elections)
        .where(
          and(
            eq(elections.status, "open"),
            lte(elections.opensAt, now),
            gte(elections.closesAt, now),
          ),
        )
        .get()) ?? null
    );
  },

  async updateStatus(
    db: DbClient,
    id: string,
    data: {
      existingStatus: TElectionStatus;
      status: TElectionStatus;
      opensAt?: number | null;
      closesAt?: number | null;
      eligibleVotersCount?: number | null;
    },
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const set: Record<string, unknown> = {
      status: data.status,
      updatedAt: sql`max(${now}, ${elections.updatedAt} + 1)`,
    };
    if (data.opensAt !== undefined) set.opensAt = data.opensAt;
    if (data.closesAt !== undefined) set.closesAt = data.closesAt;
    if (data.eligibleVotersCount !== undefined) {
      set.eligibleVotersCount = data.eligibleVotersCount;
    }
    const result = await db
      .update(elections)
      .set(set)
      .where(and(eq(elections.id, id), eq(elections.status, data.existingStatus)))
      .run();
    return result.rowsAffected > 0;
  },

  async updateMetadata(
    db: DbClient,
    id: string,
    data: Partial<Pick<ElectionRow, "name" | "description" | "opensAt" | "closesAt">>,
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .update(elections)
      .set({ ...data, updatedAt: now })
      .where(eq(elections.id, id))
      .run();
    return result.rowsAffected > 0;
  },

  async extendClosingTime(
    db: DbClient,
    id: string,
    data: { expectedClosesAt: number; closesAt: number },
  ): Promise<boolean> {
    const now = sql<number>`unixepoch()`;
    const result = await db
      .update(elections)
      .set({
        closesAt: data.closesAt,
        updatedAt: sql`max(${now}, ${elections.updatedAt} + 1)`,
      })
      .where(
        and(
          eq(elections.id, id),
          eq(elections.status, "open"),
          lte(elections.opensAt, now),
          gte(elections.closesAt, now),
          eq(elections.closesAt, data.expectedClosesAt),
          lt(elections.closesAt, data.closesAt),
        ),
      )
      .run();
    return result.rowsAffected > 0;
  },

  async findEarliestDraft(db: DbClient): Promise<ElectionRow | null> {
    return (
      (await db
        .select()
        .from(elections)
        .where(eq(elections.status, "draft"))
        .orderBy(
          asc(sql`CASE WHEN ${elections.opensAt} IS NULL THEN 1 ELSE 0 END`),
          asc(elections.opensAt),
          asc(elections.id),
        )
        .get()) ?? null
    );
  },

  async findLatestClosed(db: DbClient): Promise<ElectionRow | null> {
    return (
      (await db
        .select()
        .from(elections)
        .where(or(eq(elections.status, "closed"), eq(elections.status, "archived")))
        .orderBy(desc(elections.closesAt))
        .get()) ?? null
    );
  },

  async findLatestClosedOrExpiredOpen(
    db: DbClient,
    now = Math.floor(Date.now() / 1000),
  ): Promise<ElectionRow | null> {
    return (
      (await db
        .select()
        .from(elections)
        .where(
          or(
            eq(elections.status, "closed"),
            and(eq(elections.status, "open"), lte(elections.closesAt, now)),
          ),
        )
        .orderBy(desc(elections.closesAt), desc(elections.id))
        .get()) ?? null
    );
  },
};
