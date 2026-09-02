import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/database/schema";

const chain: any = {
  values: vi.fn(() => chain),
  set: vi.fn(() => chain),
  from: vi.fn(() => chain),
  where: vi.fn(() => chain),
  orderBy: vi.fn(() => chain),
  limit: vi.fn(() => chain),
  get: vi.fn(() => undefined),
  all: vi.fn(() => []),
  run: vi.fn(() => ({ rowsAffected: 1 })),
};
const mockDb = {
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  select: vi.fn(() => chain),
  delete: vi.fn(() => chain),
};
vi.mock("@/config/db", () => ({ createDb: () => ({ db: mockDb }) }));
import { electionRepo } from "./election.repository";

beforeEach(() => vi.clearAllMocks());

describe("electionRepo", () => {
  it("create returns an id", async () => {
    const id = await electionRepo.create(mockDb as any, { name: "CSO 2026" });
    expect(typeof id).toBe("string");
  });
  it("findById returns row or null", async () => {
    chain.get.mockReturnValueOnce({ id: "e1" });
    expect(await electionRepo.findById(mockDb as any, "e1")).toEqual({ id: "e1" });
    chain.get.mockReturnValueOnce(undefined);
    expect(await electionRepo.findById(mockDb as any, "e2")).toBeNull();
  });
  it("list filters by status", async () => {
    chain.all.mockReturnValueOnce([{ id: "e1" }]);
    expect(await electionRepo.list(mockDb as any, { status: "open" })).toHaveLength(1);
  });
  it("findOpen returns the open row", async () => {
    chain.get.mockReturnValueOnce({ id: "e1", status: "open" });
    expect((await electionRepo.findOpen(mockDb as any))?.id).toBe("e1");
  });
  it("uses election time windows for current and completed reads", async () => {
    const client = createClient({ url: "file::memory:" });

    try {
      await client.execute(
        "CREATE TABLE elections (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL, opens_at INTEGER, closes_at INTEGER, eligible_voters_count INTEGER)",
      );
      const db = drizzle(client, { schema });
      await db
        .insert(schema.elections)
        .values([
          {
            id: "expired",
            name: "Expired",
            description: null,
            status: "open",
            opensAt: 1,
            closesAt: 950,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "closed",
            name: "Closed",
            description: null,
            status: "closed",
            opensAt: 1,
            closesAt: 900,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "current",
            name: "Current",
            description: null,
            status: "open",
            opensAt: 900,
            closesAt: 1100,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: "archived",
            name: "Archived",
            description: null,
            status: "archived",
            opensAt: 1,
            closesAt: 1200,
            createdAt: 1,
            updatedAt: 1,
          },
        ])
        .run();

      expect((await electionRepo.findCurrentlyOpen(db, 1000))?.id).toBe("current");
      expect((await electionRepo.findLatestClosedOrExpiredOpen(db, 1000))?.id).toBe("expired");
      expect((await electionRepo.findLatestClosed(db))?.id).toBe("archived");
    } finally {
      client.close();
    }
  });

  it("does not treat an open election with missing bounds as currently open", async () => {
    const client = createClient({ url: "file::memory:" });

    try {
      await client.execute(
        "CREATE TABLE elections (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL, opens_at INTEGER, closes_at INTEGER, eligible_voters_count INTEGER)",
      );
      await client.execute({
        sql: "INSERT INTO elections (id, name, status, opens_at, closes_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)",
        args: [
          "missing-open",
          "Missing opening time",
          "open",
          null,
          2000,
          1,
          1,
          "missing-close",
          "Missing closing time",
          "open",
          1,
          null,
          1,
          1,
        ],
      });

      expect(await electionRepo.findCurrentlyOpen(drizzle(client, { schema }), 1000)).toBeNull();
    } finally {
      client.close();
    }
  });
  it("updateStatus updates and reports affected", async () => {
    expect(
      await electionRepo.updateStatus(mockDb as any, "e1", {
        existingStatus: "draft",
        status: "open",
      }),
    ).toBe(true);
  });
  it("keeps updatedAt unique across rapid status transitions", async () => {
    const client = createClient({ url: "file::memory:" });
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    try {
      await client.execute(
        "CREATE TABLE elections (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL, opens_at INTEGER, closes_at INTEGER, eligible_voters_count INTEGER)",
      );
      const db = drizzle(client, { schema });
      await db.insert(schema.elections).values({
        id: "e1",
        name: "CSO 2026",
        description: null,
        status: "draft",
        opensAt: null,
        closesAt: null,
        createdAt: 1,
        updatedAt: 1,
      });

      await electionRepo.updateStatus(db, "e1", {
        existingStatus: "draft",
        status: "open",
      });
      const first = await db
        .select({ updatedAt: schema.elections.updatedAt })
        .from(schema.elections)
        .where(eq(schema.elections.id, "e1"))
        .get();

      await electionRepo.updateStatus(db, "e1", {
        existingStatus: "open",
        status: "closed",
      });
      const second = await db
        .select({ updatedAt: schema.elections.updatedAt })
        .from(schema.elections)
        .where(eq(schema.elections.id, "e1"))
        .get();

      expect(second?.updatedAt).toBeGreaterThan(first?.updatedAt ?? 0);
    } finally {
      nowSpy.mockRestore();
      client.close();
    }
  });
  it("updateMetadata updates and reports affected", async () => {
    expect(await electionRepo.updateMetadata(mockDb as any, "e1", { name: "New" })).toBe(true);
  });

  it("extends only the matching active election deadline", async () => {
    const client = createClient({ url: "file::memory:" });

    try {
      await client.execute(
        "CREATE TABLE elections (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL, opens_at INTEGER, closes_at INTEGER, eligible_voters_count INTEGER)",
      );
      const db = drizzle(client, { schema });
      const clock = await client.execute("SELECT unixepoch() AS now");
      const now = Number(clock.rows[0].now);
      await db.insert(schema.elections).values({
        id: "active",
        name: "Active",
        description: null,
        status: "open",
        opensAt: now - 50,
        closesAt: now + 50,
        createdAt: 1,
        updatedAt: 1,
      });

      expect(
        await electionRepo.extendClosingTime(db, "active", {
          expectedClosesAt: now + 50,
          closesAt: now + 100,
        }),
      ).toBe(true);
      expect((await electionRepo.findById(db, "active"))?.closesAt).toBe(now + 100);

      expect(
        await electionRepo.extendClosingTime(db, "active", {
          expectedClosesAt: now + 50,
          closesAt: now + 150,
        }),
      ).toBe(false);
      expect(
        await electionRepo.extendClosingTime(db, "active", {
          expectedClosesAt: now + 100,
          closesAt: now + 100,
        }),
      ).toBe(false);
      expect((await electionRepo.findById(db, "active"))?.closesAt).toBe(now + 100);
    } finally {
      client.close();
    }
  });

  it("does not extend an election whose deadline passes before the update", async () => {
    const client = createClient({ url: "file::memory:" });

    try {
      await client.execute(
        "CREATE TABLE elections (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL, opens_at INTEGER, closes_at INTEGER, eligible_voters_count INTEGER)",
      );
      const db = drizzle(client, { schema });
      const result = await client.execute("SELECT unixepoch() AS now");
      const now = Number(result.rows[0].now);

      await db.insert(schema.elections).values({
        id: "expiring",
        name: "Expiring",
        description: null,
        status: "open",
        opensAt: now - 60,
        closesAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await new Promise((resolve) => setTimeout(resolve, 1_100));

      expect(
        await electionRepo.extendClosingTime(db, "expiring", {
          expectedClosesAt: now,
          closesAt: now + 3600,
        }),
      ).toBe(false);
      expect((await electionRepo.findById(db, "expiring"))?.closesAt).toBe(now);
    } finally {
      client.close();
    }
  });

  it("returns a scheduled draft before an unscheduled draft", async () => {
    const client = createClient({ url: "file::memory:" });

    try {
      await client.execute(
        "CREATE TABLE elections (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL, opens_at INTEGER, closes_at INTEGER, eligible_voters_count INTEGER)",
      );
      await client.execute({
        sql: "INSERT INTO elections (id, name, status, opens_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)",
        args: [
          "unscheduled",
          "Unscheduled",
          "draft",
          null,
          1,
          1,
          "scheduled",
          "Scheduled",
          "draft",
          200,
          1,
          1,
        ],
      });

      const row = await electionRepo.findEarliestDraft(drizzle(client, { schema }));

      expect(row?.id).toBe("scheduled");
    } finally {
      client.close();
    }
  });
});
