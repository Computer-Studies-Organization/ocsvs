import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for repos and utilities
const {
  mockAccountExists,
  mockAccountCreate,
  mockUsernameExists,
  mockUpdateAccount,
  mockCountActiveAdminsAndSuperAdmins,
  mockAccountSoftDelete,
  mockAccountRestore,
  mockAccountHardDelete,
  mockUpdateUser,
  mockFindByStudentId,
  mockFindById,
  mockGetAccountDeleteStatus,
  mockHashPassword,
  mockVerifyPassword,
  mockCreateSessionFn,
  mockDeleteSessionFn,
  mockRecordAttempt,
  mockClearAttempts,
  mockGetRecentAttempts,
  mockDeleteExpiredAttemptsRepo,
  mockIsCandidate,
  mockValidateProfanity,
  mockAuditLoggerInsert,
} = vi.hoisted(() => ({
  mockAccountExists: vi.fn(),
  mockAccountCreate: vi.fn(),
  mockUsernameExists: vi.fn(),
  mockUpdateAccount: vi.fn(),
  mockCountActiveAdminsAndSuperAdmins: vi.fn(),
  mockAccountSoftDelete: vi.fn(),
  mockAccountRestore: vi.fn(),
  mockAccountHardDelete: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockFindByStudentId: vi.fn(),
  mockFindById: vi.fn(),
  mockGetAccountDeleteStatus: vi.fn(),
  mockHashPassword: vi.fn(),
  mockVerifyPassword: vi.fn(),
  mockCreateSessionFn: vi.fn(),
  mockDeleteSessionFn: vi.fn(),
  mockRecordAttempt: vi.fn(),
  mockClearAttempts: vi.fn(),
  mockGetRecentAttempts: vi.fn(),
  mockDeleteExpiredAttemptsRepo: vi.fn(),
  mockIsCandidate: vi.fn(),
  mockValidateProfanity: vi.fn(),
  mockAuditLoggerInsert: vi.fn(),
}));

// Mock repositories and query files
vi.mock("@/database/repositories/account.repository", () => ({
  accountRepo: {
    accountExists: mockAccountExists,
    create: mockAccountCreate,
    usernameExists: mockUsernameExists,
    updateAccount: mockUpdateAccount,
    countActiveAdminsAndSuperAdmins: mockCountActiveAdminsAndSuperAdmins,
    softDelete: mockAccountSoftDelete,
    restore: mockAccountRestore,
    hardDelete: mockAccountHardDelete,
  },
}));

vi.mock("@/database/repositories/users.repository", () => ({
  userRepo: {
    updateUser: mockUpdateUser,
  },
}));

vi.mock("@/database/queries/user-account.queries", () => ({
  userAccountQueries: {
    findByStudentId: mockFindByStudentId,
    findById: mockFindById,
    getAccountDeleteStatus: mockGetAccountDeleteStatus,
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}));

vi.mock("@/lib/session", () => ({
  createSession: mockCreateSessionFn,
  deleteSession: mockDeleteSessionFn,
}));

vi.mock("@/database/repositories/login-attempt.repository", () => ({
  loginAttemptRepo: {
    recordAttempt: mockRecordAttempt,
    clearAttempts: mockClearAttempts,
    getRecentAttempts: mockGetRecentAttempts,
    deleteExpiredAttempts: mockDeleteExpiredAttemptsRepo,
  },
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    isCandidate: mockIsCandidate,
  },
}));

vi.mock("@/lib/profanity", () => ({
  validateProfanity: mockValidateProfanity,
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditLoggerInsert,
  },
}));

import { UserLifecycleCoordinator, UserLifecycleError } from "./user-lifecycle-coordinator";

// Mock DB
const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbWhere = vi.fn();
const mockDbFrom = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbValues = vi.fn();
const mockDbDelete = vi.fn();
const mockDbRun = vi.fn();

mockDbSelect.mockImplementation(() => ({ from: mockDbFrom }));
mockDbFrom.mockImplementation(() => ({
  where: mockDbWhere,
  all: mockDbAll,
  get: mockDbGet,
}));
mockDbWhere.mockImplementation(() => ({
  all: mockDbAll,
  get: mockDbGet,
  run: mockDbRun,
}));
mockDbInsert.mockImplementation(() => ({ values: mockDbValues }));
mockDbDelete.mockImplementation(() => ({ where: mockDbWhere }));
mockDbValues.mockImplementation(() => ({}));

const mockDb: any = {
  select: mockDbSelect,
  insert: mockDbInsert,
  delete: mockDbDelete,
  transaction: vi.fn(async (cb) => await cb(mockDb)),
};

const coordinator = new UserLifecycleCoordinator();

describe("UserLifecycleCoordinator Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateProfanity.mockReturnValue({ isClean: true });
  });

  describe("authenticate", () => {
    it("successfully authenticates user", async () => {
      mockGetRecentAttempts.mockResolvedValueOnce([]);
      mockFindByStudentId.mockResolvedValueOnce({
        id: "acc-123",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        password_hash: "hash-123",
        deletedAt: null,
      });
      mockVerifyPassword.mockResolvedValueOnce(true);
      mockCreateSessionFn.mockResolvedValueOnce({ id: "sess-123", expiresAt: 9999 });

      const result = await coordinator.authenticate(
        mockDb,
        "student-123",
        "password123",
        "127.0.0.1",
      );

      expect(result).toEqual({
        accountId: "acc-123",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        sessionId: "sess-123",
        expiresAt: 9999,
      });
      expect(mockClearAttempts).toHaveBeenCalledWith(mockDb, "student-123");
    });

    it("throws UserLifecycleError RATE_LIMITED_ACCOUNT with retryAfter if lockout threshold met", async () => {
      const oldestTimestamp = Math.floor(Date.now() / 1000) - 100;
      mockGetRecentAttempts.mockResolvedValueOnce(Array(5).fill({ attemptedAt: oldestTimestamp }));

      let thrownError: any = null;
      try {
        await coordinator.authenticate(mockDb, "student-123", "password123", "127.0.0.1");
      } catch (error: any) {
        thrownError = error;
      }

      expect(thrownError).toBeInstanceOf(UserLifecycleError);
      expect(thrownError.code).toBe("RATE_LIMITED_ACCOUNT");
      expect(thrownError.statusCode).toBe(429);
      expect(thrownError.retryAfter).toBeGreaterThan(0);
      expect(thrownError.retryAfter).toBeLessThanOrEqual(900);
    });

    it("throws INVALID_CREDENTIALS and records failure on password mismatch", async () => {
      mockGetRecentAttempts.mockResolvedValueOnce([]);
      mockFindByStudentId.mockResolvedValueOnce({
        id: "acc-123",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        password_hash: "hash-123",
        deletedAt: null,
      });
      mockVerifyPassword.mockResolvedValueOnce(false);

      await expect(
        coordinator.authenticate(mockDb, "student-123", "password123", "127.0.0.1"),
      ).rejects.toThrowError(
        expect.objectContaining({ code: "INVALID_CREDENTIALS", statusCode: 401 }),
      );
      expect(mockRecordAttempt).toHaveBeenCalledWith(mockDb, "student-123", "127.0.0.1");
    });
  });

  describe("register", () => {
    it("successfully registers a user", async () => {
      mockAccountExists.mockResolvedValueOnce(false);
      mockDbGet.mockResolvedValueOnce(null); // student id check
      mockHashPassword.mockResolvedValueOnce("hashed-password");

      const result = await coordinator.register(mockDb, {
        firstName: "John",
        lastName: "Doe",
        studentId: "student-123",
        course: "BSCS",
        yearLevel: "1st Year",
        username: "johndoe",
        email: "john@example.com",
      });

      expect(result.username).toBe("johndoe");
      expect(mockAccountCreate).toHaveBeenCalled();
    });

    it("throws USER_ALREADY_EXISTS if username/email already exists", async () => {
      mockAccountExists.mockResolvedValueOnce(true);

      await expect(
        coordinator.register(mockDb, {
          firstName: "John",
          lastName: "Doe",
          studentId: "student-123",
          course: "BSCS",
          yearLevel: "1st Year",
          username: "johndoe",
        }),
      ).rejects.toThrowError(
        expect.objectContaining({ code: "USER_ALREADY_EXISTS", statusCode: 409 }),
      );
    });

    it("throws PROFANITY_DETECTED if validation fails", async () => {
      mockValidateProfanity.mockReturnValueOnce({ isClean: false, message: "Profanity!" });

      await expect(
        coordinator.register(mockDb, {
          firstName: "badword",
          lastName: "Doe",
          studentId: "student-123",
          course: "BSCS",
          yearLevel: "1st Year",
          username: "johndoe",
        }),
      ).rejects.toThrowError(
        expect.objectContaining({ code: "PROFANITY_DETECTED", statusCode: 400 }),
      );
    });
  });

  describe("unlock", () => {
    it("successfully clears failures if actor is admin", async () => {
      await coordinator.unlock(mockDb, "student-123", {
        id: "admin-id",
        username: "admin",
        role: "admin",
      });
      expect(mockClearAttempts).toHaveBeenCalledWith(mockDb, "student-123");
    });

    it("throws FORBIDDEN if actor is not admin", async () => {
      await expect(
        coordinator.unlock(mockDb, "student-123", {
          id: "user-id",
          username: "user",
          role: "user",
        }),
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 }));
    });
  });

  describe("update", () => {
    const actor = { id: "admin-1", username: "admin", role: "super_admin" as const };

    it("successfully updates user details", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: null,
      });
      mockUsernameExists.mockResolvedValueOnce(false);

      await coordinator.update(mockDb, "user-123", { username: "newusername" }, actor);

      expect(mockUpdateAccount).toHaveBeenCalled();
      expect(mockAuditLoggerInsert).toHaveBeenCalled();
    });

    it("throws FORBIDDEN if target is admin and actor is regular admin", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "admin",
        deletedAt: null,
      });

      await expect(
        coordinator.update(
          mockDb,
          "user-123",
          { username: "newusername" },
          { id: "admin-2", username: "admin2", role: "admin" },
        ),
      ).rejects.toThrowError(expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 }));
    });

    it("throws USER_ALREADY_EXISTS (409) if uniqueness check fails inside update transaction", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: null,
      });
      mockUpdateAccount.mockRejectedValueOnce(
        new Error("UNIQUE constraint failed: accounts.username"),
      );

      await expect(
        coordinator.update(mockDb, "user-123", { username: "duplicate" }, actor),
      ).rejects.toThrowError(
        expect.objectContaining({ code: "USER_ALREADY_EXISTS", statusCode: 409 }),
      );
    });
  });

  describe("softDelete", () => {
    const actor = { id: "admin-1", username: "admin", role: "super_admin" as const };

    it("successfully soft deletes user", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: null,
      });

      await coordinator.softDelete(mockDb, "user-123", actor);

      expect(mockAccountSoftDelete).toHaveBeenCalledWith(expect.anything(), "acc-123");
      expect(mockAuditLoggerInsert).toHaveBeenCalled();
    });

    it("throws CANNOT_DELETE_SELF if actor matches target", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "admin-1",
        role: "super_admin",
        deletedAt: null,
      });

      await expect(coordinator.softDelete(mockDb, "user-123", actor)).rejects.toThrowError(
        expect.objectContaining({ code: "CANNOT_DELETE_SELF", statusCode: 400 }),
      );
    });

    it("throws CANNOT_DELETE_LAST_ADMIN when removing the last admin", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "admin",
        deletedAt: null,
      });
      mockCountActiveAdminsAndSuperAdmins.mockResolvedValueOnce(1);

      await expect(coordinator.softDelete(mockDb, "user-123", actor)).rejects.toThrowError(
        expect.objectContaining({ code: "CANNOT_DELETE_LAST_ADMIN", statusCode: 400 }),
      );
    });
  });

  describe("restore", () => {
    const actor = { id: "admin-1", username: "admin", role: "super_admin" as const };

    it("successfully restores an archived user", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: 1234567890,
      });

      await coordinator.restore(mockDb, "user-123", actor);

      expect(mockAccountRestore).toHaveBeenCalledWith(expect.anything(), "acc-123");
    });
  });

  describe("hardDelete", () => {
    const actor = { id: "admin-1", username: "admin", role: "super_admin" as const };

    it("successfully hard deletes a user who is not a candidate", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: null,
      });
      mockIsCandidate.mockResolvedValueOnce(false);
      mockFindById.mockResolvedValueOnce({ username: "johndoe", studentId: "123456" });

      await coordinator.hardDelete(mockDb, "user-123", actor);

      expect(mockAccountHardDelete).toHaveBeenCalledWith(expect.anything(), "acc-123");
    });

    it("throws USER_IS_CANDIDATE when target user is a candidate", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: null,
      });
      mockIsCandidate.mockResolvedValueOnce(true);

      await expect(coordinator.hardDelete(mockDb, "user-123", actor)).rejects.toThrowError(
        expect.objectContaining({ code: "USER_IS_CANDIDATE", statusCode: 400 }),
      );
    });
  });

  describe("bulkImport", () => {
    const actor = { id: "admin-1", username: "admin", role: "super_admin" as const };

    it("performs bulk import in batch inserts", async () => {
      mockDbAll.mockResolvedValueOnce([]); // existing student IDs check
      mockDbAll.mockResolvedValueOnce([]); // existing usernames check
      mockHashPassword.mockResolvedValue("hashed-pwd");

      const records = [
        {
          studentId: "stud-1",
          firstName: "Alice",
          lastName: "Smith",
          course: "BSCS",
          yearLevel: "1st Year",
        },
        {
          studentId: "stud-2",
          firstName: "Bob",
          lastName: "Jones",
          course: "BSIT",
          yearLevel: "2nd Year",
        },
      ];

      const result = await coordinator.bulkImport(mockDb, records, actor);

      expect(result.imported).toHaveLength(2);
      expect(result.skipped).toHaveLength(0);
      expect(mockDbInsert).toHaveBeenCalledTimes(2); // exactly 1 for accounts, 1 for users
    });
  });
});
