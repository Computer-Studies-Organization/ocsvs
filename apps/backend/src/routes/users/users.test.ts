import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "./index";

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: {
    id: "test-user-id",
    email: "test@example.com",
    username: "testuser",
    role: "admin",
  },
}));

// Mock the auth middleware
vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    c.set("authUser", mockAuthUser);
    await next();
  },
  requireAdmin: async (_c: any, next: any) => {
    await next();
  },
}));

const { mockDb, mockDbAll, mockDbValues } = vi.hoisted(() => {
  const mockDbAll = vi.fn().mockResolvedValue([]);
  const mockDbGet = vi.fn().mockResolvedValue(null);
  const mockDbWhere = vi.fn();
  const mockDbFrom = vi.fn();
  const mockDbSelect = vi.fn();
  const mockDbInsert = vi.fn();
  const mockDbValues = vi.fn();

  mockDbSelect.mockImplementation(() => ({ from: mockDbFrom }));
  mockDbFrom.mockImplementation(() => ({
    where: mockDbWhere,
    all: mockDbAll,
    get: mockDbGet,
  }));
  mockDbWhere.mockImplementation(() => ({ all: mockDbAll, get: mockDbGet }));
  mockDbInsert.mockImplementation(() => ({ values: mockDbValues }));

  return {
    mockDb: {
      select: mockDbSelect,
      insert: mockDbInsert,
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn(),
        })),
      })),
      transaction: vi.fn(async (cb) => await cb(mockDb)),
    },
    mockDbAll,
    mockDbValues,
  };
});

// Mock the database (handler still calls createDb)
vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

const {
  mockListForAdmin,
  mockFindById,
  mockGetAccountDeleteStatus,
  mockFindByStudentId,
  mockUsernameExists,
  mockUpdateAccount,
  mockSoftDelete,
  mockRestore,
  mockCountActiveAdminsAndSuperAdmins,
  mockHardDelete,
  mockIsCandidate,
  mockAccountExists,
  mockCreate,
  mockAuditLogInsert,
  mockClearAttempts,
} = vi.hoisted(() => ({
  mockListForAdmin: vi.fn(),
  mockFindById: vi.fn(),
  mockGetAccountDeleteStatus: vi.fn(),
  mockFindByStudentId: vi.fn(),
  mockUsernameExists: vi.fn(),
  mockUpdateAccount: vi.fn(),
  mockSoftDelete: vi.fn(),
  mockRestore: vi.fn(),
  mockCountActiveAdminsAndSuperAdmins: vi.fn(),
  mockHardDelete: vi.fn(),
  mockIsCandidate: vi.fn(),
  mockAccountExists: vi.fn(),
  mockCreate: vi.fn(),
  mockAuditLogInsert: vi.fn(),
  mockClearAttempts: vi.fn(),
}));

// Mock voterAccountStore
vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: {
    getAccountId: vi.fn(),
    findByAccountId: vi.fn(),
    updateUser: vi.fn(),
    listForAdmin: mockListForAdmin,
    findById: mockFindById,
    getAccountDeleteStatus: mockGetAccountDeleteStatus,
    findByStudentId: mockFindByStudentId,
    getProfile: vi.fn(),
    accountExists: mockAccountExists,
    usernameExists: mockUsernameExists,
    create: mockCreate,
    updateAccount: mockUpdateAccount,
    updatePassword: vi.fn(),
    getPasswordHash: vi.fn(),
    softDelete: mockSoftDelete,
    countActiveAdminsAndSuperAdmins: mockCountActiveAdminsAndSuperAdmins,
    restore: mockRestore,
    hardDelete: mockHardDelete,
  },
}));

vi.mock("@/database/repositories/login-attempt.repository", () => ({
  loginAttemptRepo: {
    clearAttempts: mockClearAttempts,
    deleteExpiredAttempts: vi.fn(),
    getRecentAttempts: vi.fn(),
    recordAttempt: vi.fn(),
  },
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditLogInsert,
    list: vi.fn(),
    listByTarget: vi.fn(),
  },
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    isCandidate: mockIsCandidate,
  },
}));

describe("users Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.role = "admin";
  });

  it("should return paginated list of users", async () => {
    const mockUsers = [
      {
        id: "1",
        firstName: "John",
        lastName: "Doe",
        studentId: "123456",
        accountId: "acc1",
        yearLevel: "4th Year",
        course: "BSCS",
        username: "johndoe",
        email: "john@example.com",
        role: "user",
        deletedAt: null,
        createdAt: 1234567890,
        updatedAt: 1234567890,
      },
    ];

    mockListForAdmin.mockResolvedValue({
      data: mockUsers,
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const res = await router.request("/users?page=1&limit=10", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body).toEqual({
      data: mockUsers,
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    });
    expect(mockListForAdmin).toHaveBeenCalled();
  });

  it("with defaults should use page 1 and limit 10", async () => {
    mockListForAdmin.mockResolvedValue({
      data: [{ id: "1" }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const res = await router.request("/users", { method: "GET" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.meta).toEqual({
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(mockListForAdmin).toHaveBeenCalled();
  });

  it("with custom params should use provided page and limit", async () => {
    mockListForAdmin.mockResolvedValue({
      data: [],
      meta: { total: 20, page: 2, limit: 5, totalPages: 4 },
    });

    const res = await router.request("/users?page=2&limit=5", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.meta).toEqual({
      total: 20,
      page: 2,
      limit: 5,
      totalPages: 4,
    });
    expect(mockListForAdmin).toHaveBeenCalled();
  });

  it("rejects an oversized pagination limit before querying users", async () => {
    const res = await router.request("/users?page=1&limit=101", {
      method: "GET",
    });

    expect(res.status).toBe(422);
    expect(mockListForAdmin).not.toHaveBeenCalled();
  });

  it("should request newest users first so fresh registrations appear on page one", async () => {
    mockListForAdmin.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
    });

    const res = await router.request("/users?page=1&limit=100", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    expect(mockListForAdmin).toHaveBeenCalled();
  });

  describe("DELETE /:id - deleteUser", () => {
    it("should delete user successfully", async () => {
      mockAuthUser.role = "super_admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "admin",
      });
      mockCountActiveAdminsAndSuperAdmins.mockResolvedValue(2);
      mockSoftDelete.mockResolvedValue(undefined);

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User archived successfully");
      expect(mockSoftDelete).toHaveBeenCalledWith(mockDb, "other-account-id");
      expect(mockAuditLogInsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "user.soft_delete",
          targetType: "user",
          targetId: "some-user-id",
        }),
      );
    });

    it("should delete non-admin user successfully when only 1 admin exists", async () => {
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "user",
      });
      mockSoftDelete.mockResolvedValue(undefined);

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      expect(mockSoftDelete).toHaveBeenCalledWith(mockDb, "other-account-id");
    });

    it("should return 400 when admin tries to delete themselves", async () => {
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "test-user-id", // same as TEST_USER.id
        deletedAt: null,
        role: "admin",
      });

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe("You cannot delete your own account");
      expect(mockSoftDelete).not.toHaveBeenCalled();
    });

    it("should return 400 when trying to delete the last admin", async () => {
      mockAuthUser.role = "super_admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "admin",
      });
      mockCountActiveAdminsAndSuperAdmins.mockResolvedValue(1);

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe("Cannot delete the last admin account");
      expect(mockSoftDelete).not.toHaveBeenCalled();
    });

    it("should return 403 when regular admin tries to delete another admin", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "admin",
      });

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.CANNOT_DELETE_ADMIN);
      expect(mockSoftDelete).not.toHaveBeenCalled();
    });

    it("should return 400 when user is already archived", async () => {
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: 1234567890,
        role: "user",
      });

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User is already archived");
    });

    it("should return 404 when user not found", async () => {
      mockGetAccountDeleteStatus.mockResolvedValue(null);

      const res = await router.request("/users/nonexistent-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User not found");
    });
  });

  describe("PATCH /users/:id - updateUser role checks", () => {
    it("should return 403 when regular admin tries to update an admin account", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "admin",
      });

      const res = await router.request("/users/some-user-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "hacked" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.CANNOT_UPDATE_ADMIN);
      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it("should return 403 when regular admin tries to update a super_admin account", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "super_admin",
      });

      const res = await router.request("/users/some-user-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "hacked" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.CANNOT_UPDATE_ADMIN);
      expect(mockUpdateAccount).not.toHaveBeenCalled();
    });

    it("should allow super_admin to update an admin account", async () => {
      mockAuthUser.role = "super_admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "admin",
      });
      mockUsernameExists.mockResolvedValue(false);
      mockUpdateAccount.mockResolvedValue(undefined);
      mockFindById.mockResolvedValue({
        id: "some-user-id",
        username: "newname",
        role: "admin",
        deletedAt: null,
      });

      const res = await router.request("/users/some-user-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "newname" }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateAccount).toHaveBeenCalled();
    });
  });

  describe("POST /users/:id/restore - restoreUser role checks", () => {
    it("should return 403 when regular admin tries to restore an archived admin", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: 1234567890,
        role: "admin",
      });

      const res = await router.request("/users/some-user-id/restore", {
        method: "POST",
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.CANNOT_RESTORE_ADMIN);
      expect(mockRestore).not.toHaveBeenCalled();
    });

    it("should return 403 when regular admin tries to restore an archived super_admin", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: 1234567890,
        role: "super_admin",
      });

      const res = await router.request("/users/some-user-id/restore", {
        method: "POST",
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.CANNOT_RESTORE_ADMIN);
      expect(mockRestore).not.toHaveBeenCalled();
    });

    it("should allow super_admin to restore an archived admin", async () => {
      mockAuthUser.role = "super_admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: 1234567890,
        role: "admin",
      });
      mockRestore.mockResolvedValue(undefined);

      const res = await router.request("/users/some-user-id/restore", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User restored successfully");
      expect(mockRestore).toHaveBeenCalledWith(mockDb, "other-account-id");
    });

    it("should allow regular admin to restore an archived regular user", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: 1234567890,
        role: "user",
      });
      mockRestore.mockResolvedValue(undefined);

      const res = await router.request("/users/some-user-id/restore", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      expect(mockRestore).toHaveBeenCalledWith(mockDb, "other-account-id");
    });

    it("should invalidate active sessions when soft-deleting a voter account", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "voter-account-id",
        deletedAt: null,
        role: "user",
      });
      mockSoftDelete.mockResolvedValue(undefined);

      const res = await router.request("/users/voter-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User archived successfully");
      expect(mockSoftDelete).toHaveBeenCalledWith(mockDb, "voter-account-id");
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should allow admin to restore an archived voter account enabling login capabilities", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "voter-account-id",
        deletedAt: 1700000000,
        role: "user",
      });
      mockRestore.mockResolvedValue(undefined);

      const res = await router.request("/users/voter-user-id/restore", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User restored successfully");
      expect(mockRestore).toHaveBeenCalledWith(mockDb, "voter-account-id");
      expect(mockAuditLogInsert).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "user.restore",
          targetType: "user",
          targetId: "voter-user-id",
        }),
      );
    });
  });

  describe("POST /users/import", () => {
    it("should reject non-admin requests", async () => {
      mockAuthUser.role = "user";
      const res = await router.request("/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [
            {
              studentId: "C25-01-10001-MAN121",
              firstName: "Alice",
              lastName: "Smith",
              course: "BSCS",
              yearLevel: "1st Year",
            },
          ],
        }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.FORBIDDEN);
    });

    it("should successfully import new students", async () => {
      mockDbAll.mockResolvedValueOnce([]); // existingUsers
      mockDbAll.mockResolvedValueOnce([]); // existingAccounts
      mockDbValues.mockResolvedValue([]);

      const res = await router.request("/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [
            {
              studentId: "C25-01-10001-MAN121",
              firstName: "Alice",
              lastName: "Smith",
              course: "BSCS",
              yearLevel: "1st Year",
            },
            {
              studentId: "C25-01-10002-MAN121",
              firstName: "Bob",
              lastName: "Jones",
              course: "BSIT",
              yearLevel: "2nd Year",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("Import completed successfully");
      expect(body.imported).toHaveLength(2);
      expect(body.skipped).toHaveLength(0);

      expect(body.imported[0]).toEqual(
        expect.objectContaining({
          studentId: "C25-01-10001-MAN121",
          fullName: "ALICE SMITH",
          username: "alice.smith",
          password: expect.any(String),
        }),
      );
      expect(body.imported[1]).toEqual(
        expect.objectContaining({
          studentId: "C25-01-10002-MAN121",
          fullName: "BOB JONES",
          username: "bob.jones",
          password: expect.any(String),
        }),
      );

      expect(mockDbValues).toHaveBeenCalled();
    });

    it("should handle duplicate student IDs (skipped records)", async () => {
      mockDbAll.mockResolvedValueOnce([{ studentId: "C25-01-10001-MAN121" }]); // existingUsers
      mockDbAll.mockResolvedValueOnce([]); // existingAccounts
      mockDbValues.mockResolvedValue([]);

      const res = await router.request("/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [
            {
              studentId: "C25-01-10001-MAN121",
              firstName: "Alice",
              lastName: "Smith",
              course: "BSCS",
              yearLevel: "1st Year",
            },
            {
              studentId: "C25-01-10002-MAN121",
              firstName: "Bob",
              lastName: "Jones",
              course: "BSIT",
              yearLevel: "2nd Year",
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("Import completed successfully");
      expect(body.imported).toHaveLength(1);
      expect(body.skipped).toHaveLength(1);

      expect(body.imported[0].studentId).toBe("C25-01-10002-MAN121");
      expect(body.skipped[0]).toEqual({
        studentId: "C25-01-10001-MAN121",
        reason: "Student ID already exists in the system",
      });

      expect(mockDbValues).toHaveBeenCalled();
    });

    it("should return 409 Conflict when a database unique constraint conflict occurs", async () => {
      mockDbAll.mockResolvedValueOnce([]); // existingUsers
      mockDbAll.mockResolvedValueOnce([]); // existingAccounts

      const uniqueConstraintError = new Error("UNIQUE constraint failed: accounts.username");
      mockDbValues.mockRejectedValueOnce(uniqueConstraintError);

      const res = await router.request("/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [
            {
              studentId: "C25-01-10001-MAN121",
              firstName: "Alice",
              lastName: "Smith",
              course: "BSCS",
              yearLevel: "1st Year",
            },
          ],
        }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.IMPORT_CONFLICT);
      expect(body.imported).toHaveLength(0);
      expect(body.skipped).toHaveLength(0);
    });
  });

  describe("POST /users/:id/hard-delete - hardDeleteUser", () => {
    it("should reject non-admin requests", async () => {
      mockAuthUser.role = "user";
      const res = await router.request("/users/some-user-id/hard-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.FORBIDDEN);
    });

    it("should allow super_admin to hard delete a regular user", async () => {
      mockAuthUser.role = "super_admin";
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "other-account-id",
        role: "user",
        deletedAt: null,
      });
      mockIsCandidate.mockResolvedValueOnce(false);
      mockFindById.mockResolvedValueOnce({ username: "johndoe", studentId: "stud-123" });
      mockHardDelete.mockResolvedValueOnce(undefined);

      const res = await router.request("/users/some-user-id/hard-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User permanently deleted");
      expect(mockHardDelete).toHaveBeenCalledWith(expect.anything(), "other-account-id");
    });

    it("should reject regular admin trying to hard delete an admin", async () => {
      mockAuthUser.role = "admin";
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "other-account-id",
        role: "admin",
        deletedAt: null,
      });

      const res = await router.request("/users/some-user-id/hard-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.CANNOT_DELETE_ADMIN);
    });

    it("should reject hard delete if user is a candidate", async () => {
      mockAuthUser.role = "super_admin";
      mockGetAccountDeleteStatus.mockResolvedValueOnce({
        accountId: "other-account-id",
        role: "user",
        deletedAt: null,
      });
      mockIsCandidate.mockResolvedValueOnce(true);

      const res = await router.request("/users/some-user-id/hard-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.USER_IS_CANDIDATE);
    });
  });

  describe("POST /users - createUser", () => {
    it("should allow admin to create a voter account", async () => {
      mockAuthUser.role = "admin";
      mockAccountExists.mockResolvedValue(false);
      mockCreate.mockResolvedValue(undefined);

      const res = await router.request("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          username: "johndoe",
          password: "password123",
          studentId: "C23-01-1234-CSA001",
          course: "BSCS",
          yearLevel: "1st Year",
          role: "user",
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.USER_CREATED_SUCCESSFULLY);
      expect(body.user.username).toBe("johndoe");
      expect(body.user.role).toBe("user");
      expect(mockAccountExists).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          username: "johndoe",
          studentId: "C23-01-1234-CSA001",
        }),
        expect.objectContaining({
          action: "user.create",
          targetType: "user",
          targetId: expect.any(String),
          actorAccountIdSnapshot: "test-user-id",
          actorUsernameSnapshot: "testuser",
          description: "Created user account: johndoe (C23-01-1234-CSA001)",
        }),
      );
      expect(mockAuditLogInsert).not.toHaveBeenCalled();
    });

    it("should reject regular admin trying to create an admin account", async () => {
      mockAuthUser.role = "admin";

      const res = await router.request("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          username: "johndoe",
          password: "password123",
          studentId: "C23-01-1234-CSA001",
          course: "BSCS",
          yearLevel: "1st Year",
          role: "admin",
        }),
      });

      expect(res.status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should allow super_admin to create an admin account", async () => {
      mockAuthUser.role = "super_admin";
      mockAccountExists.mockResolvedValue(false);
      mockCreate.mockResolvedValue(undefined);

      const res = await router.request("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          username: "johndoe",
          password: "password123",
          studentId: "C23-01-1234-CSA001",
          course: "BSCS",
          yearLevel: "1st Year",
          role: "admin",
        }),
      });

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.user.role).toBe("admin");
      expect(mockCreate).toHaveBeenCalled();
      expect(mockAuditLogInsert).not.toHaveBeenCalled();
    });

    it("should reject duplicate registration", async () => {
      mockAuthUser.role = "admin";
      mockAccountExists.mockResolvedValue(true);

      const res = await router.request("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          username: "johndoe",
          password: "password123",
          studentId: "C23-01-1234-CSA001",
          course: "BSCS",
          yearLevel: "1st Year",
          role: "user",
        }),
      });

      expect(res.status).toBe(409);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should return 409 when batch insert hits UNIQUE constraint on studentId", async () => {
      mockAuthUser.role = "admin";
      mockAccountExists.mockResolvedValue(false);
      mockCreate.mockRejectedValue(new Error("UNIQUE constraint failed: users.student_id"));

      const res = await router.request("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          username: "janedoe",
          password: "password123",
          studentId: "C23-01-5678-CSA001",
          course: "BSCS",
          yearLevel: "1st Year",
          role: "user",
        }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User already exists");
      expect(mockCreate).toHaveBeenCalled();
    });

    it("should return 409 when batch insert hits UNIQUE constraint on username", async () => {
      mockAuthUser.role = "admin";
      mockAccountExists.mockResolvedValue(false);
      mockCreate.mockRejectedValue(new Error("UNIQUE constraint failed: accounts.username"));

      const res = await router.request("/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          username: "janedoe",
          password: "password123",
          studentId: "C23-01-5678-CSA001",
          course: "BSCS",
          yearLevel: "1st Year",
          role: "user",
        }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.USER_ALREADY_EXISTS);
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe("POST /users/:userId/unlock", () => {
    it("should reject non-admin requests", async () => {
      mockAuthUser.role = "user";
      const res = await router.request("/users/some-user-id/unlock", {
        method: "POST",
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.message).toBe(ERROR_MESSAGES.FORBIDDEN);
    });

    it("should return 404 if user not found", async () => {
      mockAuthUser.role = "admin";
      mockFindById.mockResolvedValue(null);

      const res = await router.request("/users/some-user-id/unlock", {
        method: "POST",
      });

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User not found");
    });

    it("should successfully unlock account and record audit log if actor is admin", async () => {
      mockAuthUser.role = "admin";
      mockFindById.mockResolvedValue({
        id: "some-user-id",
        studentId: "student-123",
        role: "user",
      });
      mockClearAttempts.mockResolvedValue(undefined);
      mockAuditLogInsert.mockResolvedValue(undefined);

      const res = await router.request("/users/some-user-id/unlock", {
        method: "POST",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User unlocked successfully");
      expect(mockClearAttempts).toHaveBeenCalledWith(mockDb, "student-123");
      expect(mockAuditLogInsert).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          action: "user.unlock",
          targetType: "user",
          targetId: "some-user-id",
        }),
      );
    });
  });
});
