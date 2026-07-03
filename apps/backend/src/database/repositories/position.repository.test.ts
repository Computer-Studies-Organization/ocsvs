import { beforeEach, describe, expect, it, vi } from "vitest";
import { positions } from "@/database/schema";

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
import { positionRepo } from "./position.repository";

beforeEach(() => vi.clearAllMocks());

describe("positionRepo", () => {
  it("create returns an id and auto-increments displayOrder when omitted", async () => {
    chain.get.mockReturnValueOnce({ maxOrder: 2 });
    const id = await positionRepo.create(mockDb as any, { electionId: "e1", name: "Chairman" });
    expect(typeof id).toBe("string");
    expect(mockDb.insert).toHaveBeenCalledWith(positions);
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        displayOrder: 3,
      }),
    );
  });

  it("create uses provided displayOrder when present", async () => {
    const id = await positionRepo.create(mockDb as any, {
      electionId: "e1",
      name: "Chairman",
      displayOrder: 5,
    });
    expect(typeof id).toBe("string");
    expect(mockDb.insert).toHaveBeenCalledWith(positions);
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        displayOrder: 5,
      }),
    );
  });

  it("findById returns row or null", async () => {
    chain.get.mockReturnValueOnce({ id: "p1", name: "Chairman" });
    expect(await positionRepo.findById(mockDb as any, "p1")).toEqual({
      id: "p1",
      name: "Chairman",
    });
    chain.get.mockReturnValueOnce(undefined);
    expect(await positionRepo.findById(mockDb as any, "p2")).toBeNull();
  });

  it("listByElection returns rows", async () => {
    chain.all.mockReturnValueOnce([{ id: "p1" }, { id: "p2" }]);
    const rows = await positionRepo.listByElection(mockDb as any, "e1");
    expect(rows).toHaveLength(2);
  });

  it("update returns true when a row is affected", async () => {
    expect(await positionRepo.update(mockDb as any, "p1", { name: "Vice Chair" })).toBe(true);
  });

  it("delete returns true when a row is affected", async () => {
    expect(await positionRepo.delete(mockDb as any, "p1")).toBe(true);
  });
});
