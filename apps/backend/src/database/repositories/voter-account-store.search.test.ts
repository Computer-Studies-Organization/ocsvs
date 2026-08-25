import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, describe, expect, it } from "vitest";
import * as schema from "@/database/schema";
import { voterAccountStore } from "./voter-account-store";

const clients = new Set<ReturnType<typeof createClient>>();

afterEach(() => {
  for (const client of clients) client.close();
  clients.clear();
});

async function createSearchDb() {
  const client = createClient({ url: "file::memory:" });
  clients.add(client);
  await client.batch([
    "CREATE TABLE accounts (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_login INTEGER NOT NULL, deleted_at INTEGER, id TEXT PRIMARY KEY, role TEXT NOT NULL, username TEXT NOT NULL, email TEXT, password_hash TEXT NOT NULL)",
    "CREATE TABLE users (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, account_id TEXT NOT NULL, student_id TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, year_level TEXT NOT NULL, course TEXT NOT NULL)",
  ]);
  return drizzle(client, { schema });
}

describe("voterAccountStore.listForAdmin search", () => {
  it("matches full display names and preserves existing search and archive filters", async () => {
    const db = await createSearchDb();

    await db
      .insert(schema.accounts)
      .values([
        {
          id: "active-account",
          username: "carl.jerome",
          email: "carl@example.com",
          password_hash: "hash",
          role: "user",
          createdAt: 1,
          updatedAt: 1,
          lastLogin: 1,
        },
        {
          id: "archived-account",
          username: "archived.user",
          email: "archived@example.com",
          password_hash: "hash",
          role: "user",
          deletedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          lastLogin: 1,
        },
      ])
      .run();
    await db
      .insert(schema.users)
      .values([
        {
          id: "active-user",
          accountId: "active-account",
          studentId: "C23-01-7828-MAN121",
          firstName: "Carl Jerome",
          lastName: "Quiapo Yaun",
          yearLevel: "3rd Year",
          course: "BSCS",
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "archived-user",
          accountId: "archived-account",
          studentId: "C23-01-9999-MAN121",
          firstName: "Carl Jerome",
          lastName: "Archived",
          yearLevel: "3rd Year",
          course: "BSCS",
          createdAt: 1,
          updatedAt: 1,
        },
      ])
      .run();

    const fullName = await voterAccountStore.listForAdmin(db, {
      search: "  Carl Jerome Quiapo Yaun  ",
      limit: 20,
    });
    expect(fullName.data.map((user) => user.id)).toEqual(["active-user"]);

    const firstName = await voterAccountStore.listForAdmin(db, { search: "Jerome" });
    expect(firstName.data.map((user) => user.id)).toEqual(["active-user"]);

    const lastName = await voterAccountStore.listForAdmin(db, { search: "Quiapo" });
    expect(lastName.data.map((user) => user.id)).toEqual(["active-user"]);

    const studentId = await voterAccountStore.listForAdmin(db, { search: "7828" });
    expect(studentId.data.map((user) => user.id)).toEqual(["active-user"]);

    const username = await voterAccountStore.listForAdmin(db, { search: "carl.jerome" });
    expect(username.data.map((user) => user.id)).toEqual(["active-user"]);

    const archivedByDefault = await voterAccountStore.listForAdmin(db, {
      search: "Carl Jerome Archived",
    });
    expect(archivedByDefault.data).toHaveLength(0);

    const includeArchived = await voterAccountStore.listForAdmin(db, {
      search: "Carl Jerome Archived",
      includeDeleted: true,
    });
    expect(includeArchived.data.map((user) => user.id)).toEqual(["archived-user"]);
  });
});
