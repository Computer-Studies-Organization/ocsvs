import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { accounts, auditLog, sessions, users } from "@/database/schema";

// Distinct chains per query type so each statement handed to db.batch is
// individually identifiable (delete chain vs. update chain).
const deleteChain: any = {
  where: vi.fn(() => deleteChain),
};
const updateChain: any = {
  set: vi.fn(() => updateChain),
  where: vi.fn(() => updateChain),
};
const accountInsertChain: any = { values: vi.fn(() => accountInsertChain) };
const userInsertChain: any = { values: vi.fn(() => userInsertChain) };
const auditInsertChain: any = { values: vi.fn(() => auditInsertChain) };

const mockBatch = vi.fn((_statements: unknown[]) => Promise.resolve());

const mockDb = {
  insert: vi.fn(),
  update: vi.fn(() => updateChain),
  select: vi.fn(),
  delete: vi.fn(() => deleteChain),
  batch: mockBatch,
};
vi.mock("@/config/db", () => ({ createDb: () => ({ db: mockDb }) }));
import { accountRepo } from "./account.repository";

beforeEach(() => vi.clearAllMocks());

describe("accountRepo.create", () => {
  it("batches account, user, and audit inserts together when audit metadata is provided", async () => {
    mockDb.insert
      .mockReturnValueOnce(accountInsertChain)
      .mockReturnValueOnce(userInsertChain)
      .mockReturnValueOnce(auditInsertChain);

    await accountRepo.create(
      mockDb as any,
      {
        accountId: "account-id",
        username: "voter",
        email: "voter@example.com",
        passwordHash: "password-hash",
        studentId: "student-id",
        firstName: "Voter",
        lastName: "Example",
        course: "BSCS",
        yearLevel: "1st Year",
      },
      {
        action: "user.create",
        targetType: "user",
        targetId: "account-id",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
        description: "Created user account: voter (student-id)",
      },
    );

    expect(mockBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch).toHaveBeenCalledWith([accountInsertChain, userInsertChain, auditInsertChain]);
    expect(mockDb.insert).toHaveBeenNthCalledWith(1, accounts);
    expect(mockDb.insert).toHaveBeenNthCalledWith(2, users);
    expect(mockDb.insert).toHaveBeenNthCalledWith(3, auditLog);
    expect(auditInsertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.create",
        targetType: "user",
        targetId: "account-id",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
        description: "Created user account: voter (student-id)",
      }),
    );
  });
});

describe("accountRepo.changePasswordAndInvalidateSessions", () => {
  it("calls db.batch with both the delete-sessions and update-accounts statements", async () => {
    await accountRepo.changePasswordAndInvalidateSessions(mockDb as any, "account-id", "new-hash");

    // db.batch invoked exactly once
    expect(mockBatch).toHaveBeenCalledTimes(1);

    // The first call's first argument is the array of statements
    const statements = mockBatch.mock.calls[0]?.[0];
    expect(Array.isArray(statements)).toBe(true);
    expect(statements).toHaveLength(2);

    // Statement 1: delete from sessions where accountId = accountId
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledWith(sessions);
    expect(deleteChain.where).toHaveBeenCalledTimes(1);
    expect(deleteChain.where).toHaveBeenCalledWith(eq(sessions.accountId, "account-id"));
    expect(statements?.[0]).toBe(deleteChain);

    // Statement 2: update accounts set { password_hash, updatedAt } where id = accountId
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledWith(accounts);
    expect(updateChain.set).toHaveBeenCalledTimes(1);
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ password_hash: "new-hash" }),
    );
    expect(updateChain.where).toHaveBeenCalledTimes(1);
    expect(updateChain.where).toHaveBeenCalledWith(eq(accounts.id, "account-id"));
    expect(statements?.[1]).toBe(updateChain);
  });
});
