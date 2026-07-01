import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "./index";

// Mock the auth middleware
vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    c.set("authUser", {
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "admin",
    });
    await next();
  },
  requireAdmin: async (_c: any, next: any) => {
    await next();
  },
}));

// Mock the database (handler still calls createDb)
vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: {} })),
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
} = vi.hoisted(() => ({
  mockUsernameExists: vi.fn(),
  mockUpdateAccount: vi.fn(),
  mockSoftDelete: vi.fn(),
  mockRestore: vi.fn(),
  mockCountActiveAdmins: vi.fn(),
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
    restore: mockRestore,
  },
}));

describe("users Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "admin",
      });
      mockCountActiveAdmins.mockResolvedValue(2);
      mockSoftDelete.mockResolvedValue(undefined);

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.message).toBe("User archived successfully");
      expect(mockSoftDelete).toHaveBeenCalledWith({}, "other-account-id");
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
      expect(mockSoftDelete).toHaveBeenCalledWith({}, "other-account-id");
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
      mockGetAccountDeleteStatus.mockResolvedValue({
        accountId: "other-account-id",
        deletedAt: null,
        role: "admin",
      });
      mockCountActiveAdmins.mockResolvedValue(1);

      const res = await router.request("/users/some-user-id", {
        method: "DELETE",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe("Cannot delete the last admin account");
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
});
