import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { auditLogRepo } from "./audit-log.repository";

// Mock the DB (chainable)
const mockDb: any = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  all: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  run: vi.fn(),
};

describe("audit-log snapshot fidelity", () => {
  it("repo does not reference the accounts table (denormalised on insert)", () => {
    const repoPath = path.join(
      process.cwd(),
      "src",
      "database",
      "repositories",
      "audit-log.repository.ts",
    );
    const content = fs.readFileSync(repoPath, "utf8");
    const codeOnly = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/\baccounts\b/);
  });

  it("listByTarget returns row with actor_username_snapshot unchanged", async () => {
    const insertedRow = {
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: 1700000000,
      action: "election.create",
      targetType: "election",
      targetId: "id-1",
      actorAccountIdSnapshot: "acc-1",
      actorUsernameSnapshot: "alice",
      description: null,
    };
    mockDb.all.mockResolvedValueOnce([insertedRow]);

    const items = await auditLogRepo.listByTarget(mockDb, "election", "id-1");

    expect(items).toHaveLength(1);
    expect(items[0].actorUsernameSnapshot).toBe("alice");
    expect(items[0].actorAccountIdSnapshot).toBe("acc-1");
  });
});
