import type { DbClient } from "./database.type";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
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

  async updateStatus(
    db: DbClient,
    id: string,
    data: {
      existingStatus: TElectionStatus;
      status: TElectionStatus;
      opensAt?: number | null;
      closesAt?: number | null;
    },
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const set: Record<string, unknown> = { status: data.status, updatedAt: now };
    if (data.opensAt !== undefined) set.opensAt = data.opensAt;
    if (data.closesAt !== undefined) set.closesAt = data.closesAt;
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
        .where(eq(elections.status, "closed"))
        .orderBy(desc(elections.closesAt))
        .get()) ?? null
    );
  },
};
