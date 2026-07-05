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

const { mockDb, mockDbAll, mockDbBatch } = vi.hoisted(() => {
  const mockDbAll = vi.fn();
  const mockDbWhere = vi.fn();
  const mockDbFrom = vi.fn();
  const mockDbSelect = vi.fn();
  const mockDbBatch = vi.fn();
  const mockDbInsert = vi.fn();
  const mockDbValues = vi.fn();

  mockDbSelect.mockImplementation(() => ({ from: mockDbFrom }));
  mockDbFrom.mockImplementation(() => ({
    where: mockDbWhere,
    all: mockDbAll,
  }));
  mockDbWhere.mockImplementation(() => ({ all: mockDbAll }));
  mockDbInsert.mockImplementation(() => ({ values: mockDbValues }));

  return {
    mockDb: {
      select: mockDbSelect,
      batch: mockDbBatch,
      insert: mockDbInsert,
    },
    mockDbAll,
    mockDbBatch,
  };
});

// Mock the database (handler still calls createDb)
vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

// Mock the users repository (single-table ops only)
vi.mock("@/database/repositories/users.repository", () => ({
  userRepo: {
    getAccountId: vi.fn(),
    findByAccountId: vi.fn(),
    updateUser: vi.fn(),
  },
}));

// Mock the user account queries (joined queries)
const { mockListForAdmin, mockFindById, mockGetAccountDeleteStatus } = vi.hoisted(() => ({
  mockListForAdmin: vi.fn(),
  mockFindById: vi.fn(),
  mockGetAccountDeleteStatus: vi.fn(),
}));

vi.mock("@/database/queries/user-account.queries", () => ({
  userAccountQueries: {
    listForAdmin: mockListForAdmin,
    findById: mockFindById,
    getAccountDeleteStatus: mockGetAccountDeleteStatus,
    findByStudentId: vi.fn(),
    getProfile: vi.fn(),
  },
}));

const {
  mockUsernameExists,
  mockUpdateAccount,
  mockSoftDelete,
  mockRestore,
  mockCountActiveAdmins,
  mockCountActiveAdminsAndSuperAdmins,
} = vi.hoisted(() => ({
  mockUsernameExists: vi.fn(),
  mockUpdateAccount: vi.fn(),
  mockSoftDelete: vi.fn(),
  mockRestore: vi.fn(),
  mockCountActiveAdmins: vi.fn(),
  mockCountActiveAdminsAndSuperAdmins: vi.fn(),
}));

const { mockAuditLogInsert } = vi.hoisted(() => ({
  mockAuditLogInsert: vi.fn(),
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditLogInsert,
    list: vi.fn(),
    listByTarget: vi.fn(),
  },
}));

vi.mock("@/database/repositories/account.repository", () => ({
  accountRepo: {
    accountExists: vi.fn(),
    usernameExists: mockUsernameExists,
    create: vi.fn(),
    updateAccount: mockUpdateAccount,
    updatePassword: vi.fn(),
    getPasswordHash: vi.fn(),
    softDelete: mockSoftDelete,
    countActiveAdmins: mockCountActiveAdmins,
    countActiveAdminsAndSuperAdmins: mockCountActiveAdminsAndSuperAdmins,
    restore: mockRestore,
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
      mockCountActiveAdmins.mockResolvedValue(1);
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
              studentId: "2021-0001",
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
      mockDbBatch.mockResolvedValueOnce([]);

      const res = await router.request("/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [
            {
              studentId: "2021-0001",
              firstName: "Alice",
              lastName: "Smith",
              course: "BSCS",
              yearLevel: "1st Year",
            },
            {
              studentId: "2021-0002",
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
          studentId: "2021-0001",
          fullName: "ALICE SMITH",
          username: "alice.smith",
          password: expect.any(String),
        }),
      );
      expect(body.imported[1]).toEqual(
        expect.objectContaining({
          studentId: "2021-0002",
          fullName: "BOB JONES",
          username: "bob.jones",
          password: expect.any(String),
        }),
      );

      expect(mockDbBatch).toHaveBeenCalled();
    });

    it("should handle duplicate student IDs (skipped records)", async () => {
      mockDbAll.mockResolvedValueOnce([{ studentId: "2021-0001" }]); // existingUsers
      mockDbAll.mockResolvedValueOnce([]); // existingAccounts
      mockDbBatch.mockResolvedValueOnce([]);

      const res = await router.request("/users/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: [
            {
              studentId: "2021-0001",
              firstName: "Alice",
              lastName: "Smith",
              course: "BSCS",
              yearLevel: "1st Year",
            },
            {
              studentId: "2021-0002",
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

      expect(body.imported[0].studentId).toBe("2021-0002");
      expect(body.skipped[0]).toEqual({
        studentId: "2021-0001",
        reason: "Student ID already exists in the system",
      });

      expect(mockDbBatch).toHaveBeenCalled();
    });
  });
});
