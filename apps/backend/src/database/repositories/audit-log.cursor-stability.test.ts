import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogRepo, _decodeCursor } from "./audit-log.repository";

const chain: any = {
  from: vi.fn(() => chain),
  where: vi.fn(() => chain),
  orderBy: vi.fn(() => chain),
  limit: vi.fn(() => chain),
  all: vi.fn(() => []),
  values: vi.fn(() => chain),
  run: vi.fn(() => ({ rowsAffected: 1 })),
};
const mockDb = {
  insert: vi.fn(() => chain),
  select: vi.fn(() => chain),
  update: vi.fn(() => chain),
  delete: vi.fn(() => chain),
};

beforeEach(() => {
  vi.clearAllMocks();
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  mockDb.insert.mockReturnValue(chain);
  mockDb.select.mockReturnValue(chain);
});

function row(createdAt: number, id: string) {
  return {
    id,
    createdAt,
    action: "election.create",
    targetType: "election",
    targetId: "e1",
    actorAccountIdSnapshot: "acc",
    actorUsernameSnapshot: "u",
    description: null,
  };
}

describe("audit-log cursor pagination stability", () => {
  it("walks 5 inserted rows with limit=2 in created_at DESC order without duplicates or skips", async () => {
    const base = 1700000000;

    // 1. Insert 5 rows with monotonically increasing created_at (each insert
    //    flows through the mocked chain; no real DB).
    for (let i = 0; i < 5; i++) {
      await auditLogRepo.insert(mockDb as any, {
        action: "election.create",
        targetType: "election",
        targetId: `e${i}`,
        actorAccountIdSnapshot: "acc",
        actorUsernameSnapshot: "u",
      });
    }
    expect(mockDb.insert).toHaveBeenCalledTimes(5);

    const r = [0, 1, 2, 3, 4].map((i) => row(base + i, `id-${i}`));

    // Page 1: newest two (id-4, id-3). Page is full → nextCursor encodes id-3.
    chain.all.mockReturnValueOnce([r[4], r[3]]);
    const p1 = await auditLogRepo.list(mockDb as any, { limit: 2 });
    expect(p1.items.map((x) => x.id)).toEqual(["id-4", "id-3"]);
    expect(p1.nextCursor).not.toBeNull();
    expect(_decodeCursor(p1.nextCursor!)).toEqual({
      createdAt: r[3].createdAt,
      id: r[3].id,
    });

    // Page 2: id-2, id-1. Full again → nextCursor present.
    chain.all.mockReturnValueOnce([r[2], r[1]]);
    const p2 = await auditLogRepo.list(mockDb as any, {
      limit: 2,
      cursor: p1.nextCursor!,
    });
    expect(p2.items.map((x) => x.id)).toEqual(["id-2", "id-1"]);
    expect(p2.nextCursor).not.toBeNull();

    // Page 3: short page (id-0 alone) → nextCursor null.
    chain.all.mockReturnValueOnce([r[0]]);
    const p3 = await auditLogRepo.list(mockDb as any, {
      limit: 2,
      cursor: p2.nextCursor!,
    });
    expect(p3.items.map((x) => x.id)).toEqual(["id-0"]);
    expect(p3.nextCursor).toBeNull();

    // Aggregate: all 5 rows, DESC, no duplicates, no skips.
    const all = [...p1.items, ...p2.items, ...p3.items];
    expect(all.map((x) => x.id)).toEqual(["id-4", "id-3", "id-2", "id-1", "id-0"]);
    expect(new Set(all.map((x) => x.id)).size).toBe(5);
  });
});
