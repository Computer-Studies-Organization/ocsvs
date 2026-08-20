import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for repos and utilities
const {
  mockAccountExists,
  mockAccountCreate,
  mockUsernameExists,
  mockUpdateAccount,
  mockUpdatePassword,
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
  mockNeedsRehash,
  mockIsPasswordHashSupported,
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
  mockUpdatePassword: vi.fn(),
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
  mockNeedsRehash: vi.fn().mockReturnValue(false),
  mockIsPasswordHashSupported: vi.fn().mockReturnValue(true),
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

// Mock voterAccountStore
vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: {
    accountExists: mockAccountExists,
    create: mockAccountCreate,
    usernameExists: mockUsernameExists,
    updateAccount: mockUpdateAccount,
    updatePassword: mockUpdatePassword,
    updateUser: mockUpdateUser,
    countActiveAdminsAndSuperAdmins: mockCountActiveAdminsAndSuperAdmins,
    softDelete: mockAccountSoftDelete,
    restore: mockAccountRestore,
    hardDelete: mockAccountHardDelete,
    findByStudentId: mockFindByStudentId,
    findById: mockFindById,
    getAccountDeleteStatus: mockGetAccountDeleteStatus,
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
  needsRehash: mockNeedsRehash,
  isPasswordHashSupported: mockIsPasswordHashSupported,
  CURRENT_COST_DUMMY_HASH:
    "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
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

const mockFindOpenElection = vi.fn().mockResolvedValue(null);
vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findOpen: (...args: any[]) => mockFindOpenElection(...args),
  },
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditLoggerInsert,
  },
}));

import { UserLifecycleCoordinator, UserLifecycleError } from "./user-lifecycle-coordinator";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

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
    mockValidateProfanity.mockReturnValue(null);
    mockIsPasswordHashSupported.mockReturnValue(true);
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
      expect(mockUpdateAccount).toHaveBeenCalledWith(mockDb, "acc-123", {
        lastLogin: expect.any(Number),
      });
      expect(mockUpdateAccount.mock.invocationCallOrder[0]).toBeLessThan(
        mockCreateSessionFn.mock.invocationCallOrder[0],
      );
      expect(mockClearAttempts).toHaveBeenCalledWith(mockDb, "student-123");
    });

    it("rehashes a legacy password hash with current policy after successful login", async () => {
      mockGetRecentAttempts.mockResolvedValueOnce([]);
      mockFindByStudentId.mockResolvedValueOnce({
        id: "acc-123",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        password_hash: "legacy-hash",
        deletedAt: null,
      });
      mockVerifyPassword.mockResolvedValueOnce(true);
      mockNeedsRehash.mockReturnValueOnce(true);
      mockHashPassword.mockResolvedValueOnce("pbkdf2-sha256$100000$salt$new-hash");
      mockCreateSessionFn.mockResolvedValueOnce({ id: "sess-123", expiresAt: 9999 });

      const result = await coordinator.authenticate(
        mockDb,
        "student-123",
        "password123",
        "127.0.0.1",
      );

      expect(mockHashPassword).toHaveBeenCalledWith("password123");
      expect(mockUpdatePassword).toHaveBeenCalledWith(
        mockDb,
        "acc-123",
        "pbkdf2-sha256$100000$salt$new-hash",
      );
      expect(result.sessionId).toBe("sess-123");
    });

    it("continues login when opportunistic password rehash fails", async () => {
      mockGetRecentAttempts.mockResolvedValueOnce([]);
      mockFindByStudentId.mockResolvedValueOnce({
        id: "acc-123",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        password_hash: "legacy-hash",
        deletedAt: null,
      });
      mockVerifyPassword.mockResolvedValueOnce(true);
      mockNeedsRehash.mockReturnValueOnce(true);
      mockHashPassword.mockResolvedValueOnce("pbkdf2-sha256$600000$salt$new-hash");
      mockUpdatePassword.mockRejectedValueOnce(new Error("database unavailable"));
      mockCreateSessionFn.mockResolvedValueOnce({ id: "sess-123", expiresAt: 9999 });

      const result = await coordinator.authenticate(
        mockDb,
        "student-123",
        "password123",
        "127.0.0.1",
      );

      expect(result.sessionId).toBe("sess-123");
      expect(mockCreateSessionFn).toHaveBeenCalledWith(mockDb, "acc-123");
    });

    it("does not rehash when the stored hash already uses current policy", async () => {
      mockGetRecentAttempts.mockResolvedValueOnce([]);
      mockFindByStudentId.mockResolvedValueOnce({
        id: "acc-123",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        password_hash: "current-hash",
        deletedAt: null,
      });
      mockVerifyPassword.mockResolvedValueOnce(true);
      mockNeedsRehash.mockReturnValueOnce(false);
      mockCreateSessionFn.mockResolvedValueOnce({ id: "sess-123", expiresAt: 9999 });

      await coordinator.authenticate(mockDb, "student-123", "password123", "127.0.0.1");

      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockUpdatePassword).not.toHaveBeenCalled();
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
      expect(mockGetRecentAttempts).toHaveBeenCalledWith(mockDb, "student-123", "127.0.0.1", 900);
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
      expect(mockUpdateAccount).not.toHaveBeenCalled();
      expect(mockCreateSessionFn).not.toHaveBeenCalled();
    });

    it("does not create a session when last-login persistence fails", async () => {
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
      mockUpdateAccount.mockRejectedValueOnce(new Error("database unavailable"));

      await expect(
        coordinator.authenticate(mockDb, "student-123", "password123", "127.0.0.1"),
      ).rejects.toThrow("database unavailable");

      expect(mockUpdateAccount).toHaveBeenCalledWith(mockDb, "acc-123", {
        lastLogin: expect.any(Number),
      });
      expect(mockCreateSessionFn).not.toHaveBeenCalled();
    });

    it("treats hashes unsupported by the Worker runtime as generic failed logins", async () => {
      mockGetRecentAttempts.mockResolvedValueOnce([]);
      mockFindByStudentId.mockResolvedValueOnce({
        id: "acc-123",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        password_hash: "pbkdf2-sha256$600000$salt$hash",
        deletedAt: null,
      });
      mockIsPasswordHashSupported.mockReturnValueOnce(false);
      mockVerifyPassword.mockResolvedValueOnce(false);

      await expect(
        coordinator.authenticate(mockDb, "student-123", "password123", "127.0.0.1"),
      ).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
        statusCode: 401,
      });
      expect(mockVerifyPassword).toHaveBeenCalledWith("password123", expect.any(String));
      expect(mockRecordAttempt).toHaveBeenCalledWith(mockDb, "student-123", "127.0.0.1");
    });
  });

  describe("register", () => {
    it("rejects voter creation while an election is open", async () => {
      mockFindOpenElection.mockResolvedValueOnce({ id: "open-election" });

      await expect(
        coordinator.register(mockDb, {
          firstName: "John",
          lastName: "Doe",
          studentId: "student-123",
          course: "BSCS",
          yearLevel: "1st Year",
          username: "johndoe",
        }),
      ).rejects.toMatchObject({
        code: "ELECTION_IS_OPEN",
        statusCode: 400,
        message: ERROR_MESSAGES.ELECTION_IS_OPEN,
      });

      expect(mockAccountCreate).not.toHaveBeenCalled();
    });

    it("rechecks the electorate freeze atomically before creating a voter", async () => {
      mockFindOpenElection
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "newly-opened-election" });
      mockAccountExists.mockResolvedValueOnce(false);
      mockDbGet.mockResolvedValueOnce(null);
      mockHashPassword.mockResolvedValueOnce("hashed-password");

      await expect(
        coordinator.register(mockDb, {
          firstName: "John",
          lastName: "Doe",
          studentId: "student-123",
          course: "BSCS",
          yearLevel: "1st Year",
          username: "johndoe",
        }),
      ).rejects.toMatchObject({
        code: "ELECTION_IS_OPEN",
        statusCode: 400,
      });

      expect(mockFindOpenElection).toHaveBeenCalledTimes(2);
      expect(mockAccountCreate).not.toHaveBeenCalled();
    });

    it("allows admin account creation while an election is open", async () => {
      mockFindOpenElection.mockResolvedValue({ id: "open-election" });
      mockAccountExists.mockResolvedValueOnce(false);
      mockDbGet.mockResolvedValueOnce(null);
      mockHashPassword.mockResolvedValueOnce("hashed-password");

      await coordinator.register(mockDb, {
        firstName: "Admin",
        lastName: "User",
        studentId: "admin-123",
        course: "BSCS",
        yearLevel: "1st Year",
        username: "admin.user",
        role: "admin",
      });

      expect(mockAccountCreate).toHaveBeenCalled();
      expect(mockFindOpenElection).not.toHaveBeenCalled();
      mockFindOpenElection.mockResolvedValue(null);
    });

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

    it("includes the required user.create audit entry in account creation", async () => {
      mockAccountExists.mockResolvedValueOnce(false);
      mockDbGet.mockResolvedValueOnce(null);
      mockHashPassword.mockResolvedValueOnce("hashed-password");

      const result = await coordinator.register(
        mockDb,
        {
          firstName: "John",
          lastName: "Doe",
          studentId: "student-123",
          course: "BSCS",
          yearLevel: "1st Year",
          username: "johndoe",
        },
        {
          actorAccountIdSnapshot: "admin-id",
          actorUsernameSnapshot: "admin",
        },
      );

      expect(mockAccountCreate).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          accountId: result.accountId,
          userId: result.userId,
          username: "johndoe",
        }),
        {
          action: "user.create",
          targetType: "user",
          targetId: result.userId,
          actorAccountIdSnapshot: "admin-id",
          actorUsernameSnapshot: "admin",
          description: "Created user account: johndoe (student-123)",
        },
      );
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

    it("maps a concurrent generated-username collision to USER_ALREADY_EXISTS", async () => {
      mockDbAll.mockResolvedValueOnce([]);
      mockAccountExists.mockResolvedValueOnce(false);
      mockDbGet.mockResolvedValueOnce(null);
      mockHashPassword.mockResolvedValueOnce("hashed-password");
      mockAccountCreate.mockRejectedValueOnce(
        new Error("UNIQUE constraint failed: accounts.username"),
      );

      await expect(
        coordinator.register(mockDb, {
          firstName: "John",
          lastName: "Doe",
          studentId: "student-123",
          course: "BSCS",
          yearLevel: "1st Year",
        }),
      ).rejects.toThrowError(
        expect.objectContaining({ code: "USER_ALREADY_EXISTS", statusCode: 409 }),
      );
    });

    it("throws PROFANITY_DETECTED if validation fails", async () => {
      mockValidateProfanity.mockReturnValueOnce("Profanity!");

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
      mockFindById.mockResolvedValueOnce({
        id: "user-id-123",
        studentId: "student-123",
        username: "student-123",
      });
      await coordinator.unlock(mockDb, "user-id-123", {
        id: "admin-id",
        username: "admin",
        role: "admin",
      });
      expect(mockClearAttempts).toHaveBeenCalledWith(mockDb, "student-123");
      expect(mockAuditLoggerInsert).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          action: "user.unlock",
          targetType: "user",
          targetId: "user-id-123",
          actorAccountIdSnapshot: "admin-id",
          actorUsernameSnapshot: "admin",
        }),
      );
    });

    it("throws USER_NOT_FOUND if user does not exist", async () => {
      mockFindById.mockResolvedValueOnce(null);
      await expect(
        coordinator.unlock(mockDb, "user-id-123", {
          id: "admin-id",
          username: "admin",
          role: "admin",
        }),
      ).rejects.toThrowError(expect.objectContaining({ code: "USER_NOT_FOUND", statusCode: 404 }));
    });

    it("throws FORBIDDEN if actor is not admin", async () => {
      await expect(
        coordinator.unlock(mockDb, "user-id-123", {
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

    it("rejects archiving a voter while an election is open", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: null,
      });
      mockFindOpenElection.mockResolvedValueOnce({ id: "open-election" });

      await expect(coordinator.softDelete(mockDb, "user-123", actor)).rejects.toMatchObject({
        code: "ELECTION_IS_OPEN",
        message: ERROR_MESSAGES.ELECTION_IS_OPEN,
      });

      expect(mockAccountSoftDelete).not.toHaveBeenCalled();
    });

    it("allows archiving an admin while an election is open", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "admin",
        deletedAt: null,
      });
      mockCountActiveAdminsAndSuperAdmins.mockResolvedValueOnce(2);
      mockFindOpenElection.mockResolvedValue({ id: "open-election" });

      await coordinator.softDelete(mockDb, "user-123", actor);

      expect(mockAccountSoftDelete).toHaveBeenCalledWith(expect.anything(), "acc-123");
      expect(mockFindOpenElection).not.toHaveBeenCalled();
      mockFindOpenElection.mockResolvedValue(null);
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

    it("rejects restoring a voter while an election is open", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: 1234567890,
      });
      mockFindOpenElection.mockResolvedValueOnce({ id: "open-election" });

      await expect(coordinator.restore(mockDb, "user-123", actor)).rejects.toMatchObject({
        code: "ELECTION_IS_OPEN",
        message: ERROR_MESSAGES.ELECTION_IS_OPEN,
      });

      expect(mockAccountRestore).not.toHaveBeenCalled();
    });

    it("allows restoring an admin while an election is open", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "admin",
        deletedAt: 1234567890,
      });
      mockFindOpenElection.mockResolvedValue({ id: "open-election" });

      await coordinator.restore(mockDb, "user-123", actor);

      expect(mockAccountRestore).toHaveBeenCalledWith(expect.anything(), "acc-123");
      expect(mockFindOpenElection).not.toHaveBeenCalled();
      mockFindOpenElection.mockResolvedValue(null);
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

    it("rejects hard deletion of a voter while an election is open", async () => {
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "acc-123",
        role: "user",
        deletedAt: null,
      });
      mockIsCandidate.mockResolvedValueOnce(false);
      mockFindOpenElection.mockResolvedValueOnce({ id: "open-election" });

      await expect(coordinator.hardDelete(mockDb, "user-123", actor)).rejects.toMatchObject({
        code: "ELECTION_IS_OPEN",
        message: ERROR_MESSAGES.ELECTION_IS_OPEN,
      });

      expect(mockAccountHardDelete).not.toHaveBeenCalled();
    });
  });

  describe("bulkImport", () => {
    const actor = { id: "admin-1", username: "admin", role: "super_admin" as const };

    it("rejects voter import while an election is open", async () => {
      mockDbAll.mockResolvedValueOnce([]); // existing student IDs check
      mockDbAll.mockResolvedValueOnce([]); // existing usernames check
      mockHashPassword.mockResolvedValue("hashed-pwd");
      mockFindOpenElection.mockResolvedValueOnce({ id: "open-election" });

      await expect(
        coordinator.bulkImport(
          mockDb,
          [
            {
              studentId: "stud-1",
              firstName: "Alice",
              lastName: "Smith",
              course: "BSCS",
              yearLevel: "1st Year",
            },
          ],
          actor,
        ),
      ).rejects.toMatchObject({
        code: "ELECTION_IS_OPEN",
        message: ERROR_MESSAGES.ELECTION_IS_OPEN,
      });

      expect(mockDbInsert).not.toHaveBeenCalled();
    });

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

    it("skips records with profanity and preserves the validation message", async () => {
      mockDbAll.mockResolvedValueOnce([]); // existing student IDs check
      mockDbAll.mockResolvedValueOnce([]); // existing usernames check
      mockValidateProfanity.mockReturnValueOnce("firstName contains inappropriate language");
      mockValidateProfanity.mockReturnValueOnce(null);

      const result = await coordinator.bulkImport(
        mockDb,
        [
          {
            studentId: "stud-1",
            firstName: "Bad",
            lastName: "Name",
            course: "BSCS",
            yearLevel: "1st Year",
          },
        ],
        actor,
      );

      expect(result.imported).toHaveLength(0);
      expect(result.skipped).toEqual([
        {
          studentId: "stud-1",
          reason: "firstName contains inappropriate language",
        },
      ]);
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  });
});
