import { beforeEach, describe, expect, it, vi } from "vitest";

// Spy on the individual filter operators so each "list with <filter>" test can
// assert that the right Drizzle helper was called with the expected column +
// value. `and`, `or`, `desc` are left as the real implementations so the
// WHERE expression still composes correctly during the test call.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(actual.eq),
    lt: vi.fn(actual.lt),
    gte: vi.fn(actual.gte),
    lte: vi.fn(actual.lte),
  };
});

import { eq, gte, lt, lte } from "drizzle-orm";
import { auditLog } from "@/database/schema";
import {
  auditLogRepo,
  _encodeCursor,
  _decodeCursor,
  type AuditLogRow,
} from "./audit-log.repository";

const chain: any = {
  values: vi.fn(() => chain),
  set: vi.fn(() => chain),
  from: vi.fn(() => chain),
  where: vi.fn(() => chain),
  orderBy: vi.fn(() => chain),
  limit: vi.fn(() => chain),
  offset: vi.fn(() => chain),
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

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish the chainable mockReturnValue after clearAllMocks wipes them.
  chain.values.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.offset.mockReturnValue(chain);
  chain.insert = undefined as any;
  chain.select = undefined as any;
  mockDb.insert.mockReturnValue(chain);
  mockDb.update.mockReturnValue(chain);
  mockDb.select.mockReturnValue(chain);
  mockDb.delete.mockReturnValue(chain);
});

function captureWhere(): { where: ReturnType<typeof vi.fn>; arg: () => unknown } {
  let captured: unknown;
  chain.where.mockImplementationOnce((arg: unknown) => {
    captured = arg;
    return chain;
  });
  return { where: chain.where, arg: () => captured };
}

function captureValues(): { arg: () => Record<string, unknown> | undefined } {
  let captured: Record<string, unknown> | undefined;
  chain.values.mockImplementationOnce((arg: Record<string, unknown>) => {
    captured = arg;
    return chain;
  });
  return { arg: () => captured };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("auditLogRepo.insert", () => {
  it("generates a UUID and a recent unix-second timestamp, and omits description when null/undefined", async () => {
    const before = Math.floor(Date.now() / 1000);
    const { arg } = captureValues();

    const { id, createdAt } = await auditLogRepo.insert(mockDb as any, {
      action: "election.create",
      targetType: "election",
      targetId: "e1",
      actorAccountIdSnapshot: "acc-1",
      actorUsernameSnapshot: "alice",
      description: undefined,
    });
    const after = Math.floor(Date.now() / 1000);

    expect(id).toMatch(UUID_RE);
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
    expect(Number.isInteger(createdAt)).toBe(true);

    expect(mockDb.insert).toHaveBeenCalledWith(auditLog);
    const values = arg();
    expect(values).toBeDefined();
    expect(values!.id).toBe(id);
    expect(values!.createdAt).toBe(createdAt);
    expect(values!.action).toBe("election.create");
    expect(values!.targetType).toBe("election");
    expect(values!.targetId).toBe("e1");
    expect(values!.actorAccountIdSnapshot).toBe("acc-1");
    expect(values!.actorUsernameSnapshot).toBe("alice");
    expect("description" in values!).toBe(false);
  });

  it("includes description when a string is provided", async () => {
    const { arg } = captureValues();
    await auditLogRepo.insert(mockDb as any, {
      action: "election.update",
      targetType: "election",
      targetId: "e1",
      actorAccountIdSnapshot: "acc-1",
      actorUsernameSnapshot: "alice",
      description: "Changed name from 'Foo' to 'Bar'",
    });
    const values = arg();
    expect(values).toBeDefined();
    expect(values!.description).toBe("Changed name from 'Foo' to 'Bar'");
  });

  it("treats an explicit null description as omitted (DB default NULL applies)", async () => {
    const { arg } = captureValues();
    await auditLogRepo.insert(mockDb as any, {
      action: "position.create",
      targetType: "position",
      targetId: "p1",
      actorAccountIdSnapshot: "acc-1",
      actorUsernameSnapshot: "alice",
      description: null,
    });
    const values = arg();
    expect("description" in values!).toBe(false);
  });
});

describe("auditLogRepo.list", () => {
  it("with no filters issues select/from/orderBy/limit(50)/all and returns mapped rows", async () => {
    const rows: AuditLogRow[] = [
      {
        id: "a1",
        createdAt: 200,
        action: "election.create",
        targetType: "election",
        targetId: "e1",
        actorAccountIdSnapshot: "acc-1",
        actorUsernameSnapshot: "alice",
        description: null,
      },
      {
        id: "a2",
        createdAt: 100,
        action: "election.update",
        targetType: "election",
        targetId: "e2",
        actorAccountIdSnapshot: "acc-2",
        actorUsernameSnapshot: "bob",
        description: "edited",
      },
    ];
    chain.all.mockReturnValueOnce(rows);

    const result = await auditLogRepo.list(mockDb as any);

    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(chain.from).toHaveBeenCalledWith(auditLog);
    expect(chain.orderBy).toHaveBeenCalledTimes(1);
    expect(chain.limit).toHaveBeenCalledWith(50);
    expect(chain.all).toHaveBeenCalledTimes(1);
    // No filter ⇒ .where() is still invoked but receives `undefined`
    // (matches the existing `electionRepo.list` pattern).
    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(chain.where).toHaveBeenCalledWith(undefined);
    expect(result.items).toEqual(rows);
    expect(result.items).toHaveLength(2);
  });

  it("uses limit=200 (clamped) when caller asks for an oversized limit", async () => {
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { limit: 9999 });
    expect(chain.limit).toHaveBeenCalledWith(200);
  });

  it("uses limit=50 by default when limit is undefined", async () => {
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, {});
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("clamps a non-positive limit up to the floor of 1", async () => {
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { limit: 0 });
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("applies actorId filter via eq(actorAccountIdSnapshot, ...)", async () => {
    const { arg } = captureWhere();
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { actorId: "actor-123" });
    expect(arg()).toBeTruthy();
    const calls = vi.mocked(eq).mock.calls;
    expect(
      calls.some(([col, val]) => col === auditLog.actorAccountIdSnapshot && val === "actor-123"),
    ).toBe(true);
  });

  it("applies action filter via eq(action, ...)", async () => {
    const { arg } = captureWhere();
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { action: "election.create" });
    expect(arg()).toBeTruthy();
    const calls = vi.mocked(eq).mock.calls;
    expect(calls.some(([col, val]) => col === auditLog.action && val === "election.create")).toBe(
      true,
    );
  });

  it("applies targetType filter via eq(targetType, ...)", async () => {
    const { arg } = captureWhere();
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { targetType: "candidate" });
    expect(arg()).toBeTruthy();
    const calls = vi.mocked(eq).mock.calls;
    expect(calls.some(([col, val]) => col === auditLog.targetType && val === "candidate")).toBe(
      true,
    );
  });

  it("applies targetId filter via eq(targetId, ...)", async () => {
    const { arg } = captureWhere();
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { targetId: "tgt-42" });
    expect(arg()).toBeTruthy();
    const calls = vi.mocked(eq).mock.calls;
    expect(calls.some(([col, val]) => col === auditLog.targetId && val === "tgt-42")).toBe(true);
  });

  it("applies since filter via gte(createdAt, ...)", async () => {
    const { arg } = captureWhere();
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { since: 1700000000 });
    expect(arg()).toBeTruthy();
    const calls = vi.mocked(gte).mock.calls;
    expect(calls.some(([col, val]) => col === auditLog.createdAt && val === 1700000000)).toBe(true);
  });

  it("applies until filter via lte(createdAt, ...)", async () => {
    const { arg } = captureWhere();
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { until: 1800000000 });
    expect(arg()).toBeTruthy();
    const calls = vi.mocked(lte).mock.calls;
    expect(calls.some(([col, val]) => col === auditLog.createdAt && val === 1800000000)).toBe(true);
  });

  it("applies cursor: decodes it and adds lt(eq) predicates for createdAt and id", async () => {
    const original = { createdAt: 1700000000, id: "abc-uuid-1" };
    const encoded = _encodeCursor(original);
    // URL-safe base64: no '+', '/', or '=' padding.
    expect(encoded).not.toMatch(/[+/=]/);

    const { arg } = captureWhere();
    chain.all.mockReturnValueOnce([]);
    await auditLogRepo.list(mockDb as any, { cursor: encoded });

    expect(arg()).toBeTruthy();
    const ltCalls = vi.mocked(lt).mock.calls;
    expect(
      ltCalls.some(([col, val]) => col === auditLog.createdAt && val === original.createdAt),
    ).toBe(true);
    expect(ltCalls.some(([col, val]) => col === auditLog.id && val === original.id)).toBe(true);
  });

  it("encodes then decodes a cursor losslessly (round-trip)", () => {
    const c = { createdAt: 1717000000, id: "11111111-2222-3333-4444-555555555555" };
    const encoded = _encodeCursor(c);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(_decodeCursor(encoded)).toEqual(c);
  });

  it("throws on a malformed cursor", () => {
    // Not "number:id" — no colon separator.
    expect(() =>
      _decodeCursor(Buffer.from("no-colon-here", "utf-8").toString("base64url")),
    ).toThrow(/invalid cursor/);
    // Non-numeric createdAt segment.
    expect(() => _decodeCursor(Buffer.from("abc:def", "utf-8").toString("base64url"))).toThrow(
      /invalid cursor/,
    );
  });

  it("returns nextCursor when items.length === limit, encoding the last item's createdAt:id", async () => {
    const rows: AuditLogRow[] = Array.from({ length: 3 }, (_, i) => ({
      id: `row-${i}`,
      createdAt: 1000 - i,
      action: "election.create",
      targetType: "election",
      targetId: `e${i}`,
      actorAccountIdSnapshot: "acc",
      actorUsernameSnapshot: "u",
      description: null,
    }));
    chain.all.mockReturnValueOnce(rows);

    const result = await auditLogRepo.list(mockDb as any, { limit: 3 });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).not.toBeNull();
    // Round-trip the returned cursor and verify it points at the LAST row.
    expect(_decodeCursor(result.nextCursor!)).toEqual({
      createdAt: rows[rows.length - 1].createdAt,
      id: rows[rows.length - 1].id,
    });
  });

  it("returns nextCursor=null when items.length < limit (page was not full)", async () => {
    chain.all.mockReturnValueOnce([
      {
        id: "only",
        createdAt: 999,
        action: "election.create",
        targetType: "election",
        targetId: "e1",
        actorAccountIdSnapshot: "acc",
        actorUsernameSnapshot: "u",
        description: null,
      },
    ]);
    const result = await auditLogRepo.list(mockDb as any, { limit: 50 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});

describe("auditLogRepo.listByTarget", () => {
  it("filters by (targetType, targetId), orders desc, and does NOT call .limit()", async () => {
    const rows: AuditLogRow[] = [
      {
        id: "r2",
        createdAt: 200,
        action: "position.update",
        targetType: "position",
        targetId: "p1",
        actorAccountIdSnapshot: "acc",
        actorUsernameSnapshot: "u",
        description: null,
      },
      {
        id: "r1",
        createdAt: 100,
        action: "position.create",
        targetType: "position",
        targetId: "p1",
        actorAccountIdSnapshot: "acc",
        actorUsernameSnapshot: "u",
        description: null,
      },
    ];
    chain.all.mockReturnValueOnce(rows);

    const out = await auditLogRepo.listByTarget(mockDb as any, "position", "p1");

    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(chain.from).toHaveBeenCalledWith(auditLog);
    expect(chain.where).toHaveBeenCalledTimes(1);
    expect(chain.orderBy).toHaveBeenCalledTimes(1);
    // Unbounded by design — must NOT call .limit().
    expect(chain.limit).not.toHaveBeenCalled();
    expect(chain.all).toHaveBeenCalledTimes(1);

    const eqCalls = vi.mocked(eq).mock.calls;
    expect(eqCalls.some(([col, val]) => col === auditLog.targetType && val === "position")).toBe(
      true,
    );
    expect(eqCalls.some(([col, val]) => col === auditLog.targetId && val === "p1")).toBe(true);

    expect(out).toEqual(rows);
  });
});
