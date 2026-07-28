import { beforeEach, describe, expect, it, vi } from "vitest";

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
  delete: vi.fn(() => deleteChain),
  batch: mockBatch,
};
vi.mock("@/config/db", () => ({ createDb: () => ({ db: mockDb }) }));
import { voterAccountStore } from "./voter-account-store";

beforeEach(() => vi.clearAllMocks());

describe("voterAccountStore.create", () => {
  it("batches account, user, and audit inserts together when audit metadata is provided", async () => {
    mockDb.insert
      .mockReturnValueOnce(accountInsertChain)
      .mockReturnValueOnce(userInsertChain)
      .mockReturnValueOnce(auditInsertChain);

    await voterAccountStore.create(
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

    expect(mockDb.insert).toHaveBeenCalledTimes(3);
    expect(accountInsertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "account-id",
        username: "voter",
        email: "voter@example.com",
        password_hash: "password-hash",
        role: "user",
      }),
    );
    expect(userInsertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account-id",
        studentId: "student-id",
        firstName: "Voter",
        lastName: "Example",
        course: "BSCS",
        yearLevel: "1st Year",
      }),
    );
    expect(auditInsertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.create",
        targetType: "user",
        targetId: "account-id",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      }),
    );
    expect(mockBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch).toHaveBeenCalledWith([accountInsertChain, userInsertChain, auditInsertChain]);
  });
});

describe("voterAccountStore.changePasswordAndInvalidateSessions", () => {
  it("batches session delete and account password update together", async () => {
    await voterAccountStore.changePasswordAndInvalidateSessions(
      mockDb as any,
      "account-id",
      "new-hash",
    );

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockBatch).toHaveBeenCalledTimes(1);
    expect(mockBatch).toHaveBeenCalledWith([deleteChain, updateChain]);
  });
});
