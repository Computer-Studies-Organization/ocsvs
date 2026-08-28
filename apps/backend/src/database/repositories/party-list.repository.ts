import type { DbClient } from "./database.type";
import { asc, eq } from "drizzle-orm";
import { candidates, partyLists } from "@/database/schema";

export type PartyListRow = typeof partyLists.$inferSelect;

export const partyListRepo = {
  async create(
    db: DbClient,
    data: {
      electionId: string;
      name: string;
      code: string;
      color?: string | null;
      description?: string | null;
    },
  ): Promise<string> {
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(partyLists)
      .values({
        id,
        electionId: data.electionId,
        name: data.name,
        code: data.code,
        color: data.color ?? null,
        description: data.description ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  },

  async findById(db: DbClient, id: string): Promise<PartyListRow | null> {
    return (await db.select().from(partyLists).where(eq(partyLists.id, id)).get()) ?? null;
  },

  async listByElection(db: DbClient, electionId: string): Promise<PartyListRow[]> {
    return await db
      .select()
      .from(partyLists)
      .where(eq(partyLists.electionId, electionId))
      .orderBy(asc(partyLists.name), asc(partyLists.createdAt))
      .all();
  },

  async update(
    db: DbClient,
    id: string,
    data: Partial<Pick<PartyListRow, "name" | "code" | "color" | "description">>,
  ): Promise<boolean> {
    const result = await db
      .update(partyLists)
      .set({ ...data, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(partyLists.id, id))
      .run();
    return result.rowsAffected > 0;
  },

  async delete(db: DbClient, id: string): Promise<boolean> {
    // IMPORTANT: This method performs two sequential writes and MUST be called
    // within a transaction for atomicity. The coordinator always provides a tx.
    //
    // Manually nullify candidates.party_id before deleting the party row.
    // The schema declares onDelete: "set null" on this FK, but Drizzle silently
    // drops ON DELETE clauses from ALTER TABLE ADD COLUMN statements (bug #5619:
    // https://github.com/drizzle-team/drizzle-orm/issues/5619). With PRAGMA
    // foreign_keys = ON, the bare REFERENCES acts as NO ACTION (RESTRICT), so a
    // direct DELETE FROM party_lists would fail if any candidate still references
    // the party. All app-level deletes go through this method, so behaviour is
    // correct — but direct SQL deletes would violate the FK.
    await db.update(candidates).set({ partyId: null }).where(eq(candidates.partyId, id)).run();
    const result = await db.delete(partyLists).where(eq(partyLists.id, id)).run();
    return result.rowsAffected > 0;
  },
};
