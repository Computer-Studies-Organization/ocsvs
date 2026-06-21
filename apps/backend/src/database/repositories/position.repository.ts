import type { Database } from "./database.type";
import { asc, eq } from "drizzle-orm";
import { positions } from "@/database/schema";

export type PositionRow = typeof positions.$inferSelect;

export const positionRepo = {
  async create(
    db: Database,
    data: { electionId: string; name: string; displayOrder?: number },
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(positions)
      .values({
        id,
        electionId: data.electionId,
        name: data.name,
        displayOrder: data.displayOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  },

  async findById(db: Database, id: string): Promise<PositionRow | null> {
    return (await db.select().from(positions).where(eq(positions.id, id)).get()) ?? null;
  },

  async listByElection(db: Database, electionId: string): Promise<PositionRow[]> {
    return await db
      .select()
      .from(positions)
      .where(eq(positions.electionId, electionId))
      .orderBy(asc(positions.displayOrder), asc(positions.createdAt))
      .all();
  },

  async update(
    db: Database,
    id: string,
    data: Partial<Pick<PositionRow, "name" | "displayOrder">>,
  ): Promise<boolean> {
    const result = await db
      .update(positions)
      .set({ ...data, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(positions.id, id))
      .run();
    return result.rowsAffected > 0;
  },

  async delete(db: Database, id: string): Promise<boolean> {
    const result = await db.delete(positions).where(eq(positions.id, id)).run();
    return result.rowsAffected > 0;
  },
};
