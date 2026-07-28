import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "../../routes/users/index";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

const { mockAuthUser } = vi.hoisted(() => ({
  mockAuthUser: {
    id: "admin-id",
    username: "admin",
    role: "admin",
  },
}));

// Mock the database and dependencies
vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

vi.mock("@/middleware/auth", () => ({
  requireAuth: vi.fn((c: any, next: any) => {
    c.set("authUser", mockAuthUser);
    return next();
  }),
  requireAdmin: vi.fn((c: any, next: any) => next()),
}));

// Mock repositories
const mockGetAccountDeleteStatus = vi.fn();
const mockIsCandidate = vi.fn();
const mockCountActiveAdminsAndSuperAdmins = vi.fn();
const mockHardDelete = vi.fn();
const mockInsert = vi.fn();
const mockFindById = vi.fn();

vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: {
    getAccountDeleteStatus: (...args: any[]) => mockGetAccountDeleteStatus(...args),
    findById: (...args: any[]) => mockFindById(...args),
    hardDelete: (...args: any[]) => mockHardDelete(...args),
    countActiveAdminsAndSuperAdmins: (...args: any[]) =>
      mockCountActiveAdminsAndSuperAdmins(...args),
  },
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    isCandidate: (...args: any[]) => mockIsCandidate(...args),
  },
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: (...args: any[]) => mockInsert(...args),
  },
}));

const mockDb = {
  transaction: vi.fn((cb) => cb(mockDb)),
};

describe("hardDeleteUser handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.id = "admin-id";
    mockAuthUser.username = "admin";
    mockAuthUser.role = "admin";
  });

  it("should require DELETE confirmation", async () => {
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "user-acc-id",
      deletedAt: null,
      role: "user",
    });

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "NOT_DELETE" }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  it("should block hard delete for candidates", async () => {
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "user-acc-id",
      deletedAt: null,
      role: "user",
    });
    mockIsCandidate.mockResolvedValue(true);

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toBe(ERROR_MESSAGES.USER_IS_CANDIDATE);
    expect(mockIsCandidate).toHaveBeenCalledWith(mockDb, "user-acc-id");
  });

  it("should block self-deletion", async () => {
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "admin-id",
      deletedAt: null,
      role: "admin",
    });

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toBe(ERROR_MESSAGES.CANNOT_DELETE_SELF);
  });

  it("should block admin from deleting other admins", async () => {
    mockAuthUser.role = "admin";
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "target-admin-id",
      deletedAt: null,
      role: "admin",
    });
    mockIsCandidate.mockResolvedValue(false);

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.message).toBe(ERROR_MESSAGES.CANNOT_DELETE_ADMIN);
  });

  it("should block deletion of last admin", async () => {
    mockAuthUser.role = "super_admin";
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "target-admin-id",
      deletedAt: null,
      role: "admin",
    });
    mockIsCandidate.mockResolvedValue(false);
    mockCountActiveAdminsAndSuperAdmins.mockResolvedValue(1);

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toBe(ERROR_MESSAGES.CANNOT_DELETE_LAST_ADMIN);
  });

  it("should successfully hard delete a regular user", async () => {
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "target-user-id",
      deletedAt: null,
      role: "user",
    });
    mockIsCandidate.mockResolvedValue(false);
    mockFindById.mockResolvedValue({
      username: "targetuser",
      studentId: "C24-1234",
    });

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("User permanently deleted");
    expect(mockHardDelete).toHaveBeenCalledWith(mockDb, "target-user-id");
    expect(mockInsert).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: "user.hard_delete",
      }),
    );
  });

  it("should allow super_admin to delete another admin", async () => {
    mockAuthUser.id = "superadmin-id";
    mockAuthUser.role = "super_admin";
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "target-admin-id",
      deletedAt: null,
      role: "admin",
    });
    mockIsCandidate.mockResolvedValue(false);
    mockCountActiveAdminsAndSuperAdmins.mockResolvedValue(2);
    mockFindById.mockResolvedValue({
      username: "targetadmin",
      studentId: "C24-5678",
    });

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("User permanently deleted");
    expect(mockHardDelete).toHaveBeenCalledWith(mockDb, "target-admin-id");
    expect(mockInsert).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: "user.hard_delete",
      }),
    );
  });

  it("should return 404 if user is not found", async () => {
    mockGetAccountDeleteStatus.mockResolvedValue(null);

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.message).toBe(ERROR_MESSAGES.USER_NOT_FOUND);
  });

  it("should successfully hard delete an archived/soft-deleted user", async () => {
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "target-user-id",
      deletedAt: 1234567,
      role: "user",
    });
    mockIsCandidate.mockResolvedValue(false);
    mockFindById.mockResolvedValue({
      username: "targetuser",
      studentId: "C24-1234",
    });

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("User permanently deleted");
    expect(mockHardDelete).toHaveBeenCalledWith(mockDb, "target-user-id");
  });

  it("should allow super_admin to hard delete an archived admin even if active admin count is 1", async () => {
    mockAuthUser.id = "superadmin-id";
    mockAuthUser.role = "super_admin";
    mockGetAccountDeleteStatus.mockResolvedValue({
      accountId: "target-admin-id",
      deletedAt: 1234567,
      role: "admin",
    });
    mockIsCandidate.mockResolvedValue(false);
    mockCountActiveAdminsAndSuperAdmins.mockResolvedValue(1);
    mockFindById.mockResolvedValue({
      username: "targetadmin",
      studentId: "C24-5678",
    });

    const res = await router.request("/users/some-user-id/hard-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("User permanently deleted");
    expect(mockHardDelete).toHaveBeenCalledWith(mockDb, "target-admin-id");
  });
});
