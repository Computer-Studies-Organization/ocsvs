import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "./index";

// Mock the auth middleware
vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    c.set("authUser", {
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
    });
    await next();
  },
  requireAdmin: async (_c: any, next: any) => {
    await next();
  },
}));

// Mock the database
vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: {} })),
}));

// Mock the account repository
const { mockUsernameExists, mockUpdateAccount, mockGetPasswordHash, mockUpdatePassword } =
  vi.hoisted(() => ({
    mockUsernameExists: vi.fn(),
    mockUpdateAccount: vi.fn(),
    mockGetPasswordHash: vi.fn(),
    mockUpdatePassword: vi.fn(),
  }));

vi.mock("@/database/repositories/account.repository", () => ({
  accountRepo: {
    accountExists: vi.fn(),
    usernameExists: mockUsernameExists,
    create: vi.fn(),
    updateAccount: mockUpdateAccount,
    updatePassword: mockUpdatePassword,
    getPasswordHash: mockGetPasswordHash,
    softDelete: vi.fn(),
    restore: vi.fn(),
  },
}));

// Mock the users repository
const { mockFindByAccountId, mockUpdateUser } = vi.hoisted(() => ({
  mockFindByAccountId: vi.fn(),
  mockUpdateUser: vi.fn(),
}));

vi.mock("@/database/repositories/users.repository", () => ({
  userRepo: {
    findByAccountId: mockFindByAccountId,
    getAccountId: vi.fn(),
    updateUser: mockUpdateUser,
  },
}));

// Mock the user account queries
const { mockGetProfile } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
}));

vi.mock("@/database/queries/user-account.queries", () => ({
  userAccountQueries: {
    getProfile: mockGetProfile,
    listForAdmin: vi.fn(),
    findById: vi.fn(),
    findByStudentId: vi.fn(),
    getAccountDeleteStatus: vi.fn(),
  },
}));

// Mock password functions
const { mockVerifyPassword } = vi.hoisted(() => ({
  mockVerifyPassword: vi.fn(),
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("new-hashed-password"),
  verifyPassword: mockVerifyPassword,
}));

// Mock profanity filter
const { mockValidateProfanity } = vi.hoisted(() => ({
  mockValidateProfanity: vi.fn(),
}));

vi.mock("@/lib/profanity", () => ({
  validateProfanity: mockValidateProfanity,
}));

// Mock session functions
const { mockDeleteAllSessionsForAccount, mockCreateSession, mockSetSessionCookie } = vi.hoisted(
  () => ({
    mockDeleteAllSessionsForAccount: vi.fn().mockResolvedValue(undefined),
    mockCreateSession: vi.fn().mockResolvedValue({
      id: "new-session-id",
      accountId: "test-user-id",
      expiresAt: 9999999999,
    }),
    mockSetSessionCookie: vi.fn(),
  }),
);

vi.mock("@/lib/session", () => ({
  deleteAllSessionsForAccount: mockDeleteAllSessionsForAccount,
  createSession: mockCreateSession,
  setSessionCookie: mockSetSessionCookie,
  getSessionIdFromCookie: vi.fn(),
  getSessionAccount: vi.fn(),
  deleteSession: vi.fn(),
  clearSessionCookie: vi.fn(),
}));

describe("profile Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get current user profile", async () => {
    const mockProfile = {
      id: "test-user-id",
      username: "testuser",
      email: "test@example.com",
      role: "user",
      studentId: "C23-01-12345-CS001",
      firstName: "John",
      lastName: "Doe",
      yearLevel: "1st Year",
      course: "BSCS",
    };

    mockGetProfile.mockResolvedValue(mockProfile);

    const res = await router.request("/me/profile", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.username).toBe("testuser");
    expect(body.firstName).toBe("John");
    expect(mockGetProfile).toHaveBeenCalled();
  });

  it("should update user profile", async () => {
    mockFindByAccountId.mockResolvedValue({ id: "user-record-id" });
    mockValidateProfanity.mockReturnValue({ isClean: true, message: null });
    mockUsernameExists.mockResolvedValue(false);
    mockUpdateAccount.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue(undefined);

    const updatedProfile = {
      id: "test-user-id",
      username: "newusername",
      email: "test@example.com",
      role: "user",
      studentId: "C23-01-12345-CS001",
      firstName: "Jane",
      lastName: "Doe",
      yearLevel: "1st Year",
      course: "BSCS",
    };
    mockGetProfile.mockResolvedValue(updatedProfile);

    const res = await router.request("/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Jane",
        username: "newusername",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Profile updated successfully");
    expect(body.profile.firstName).toBe("Jane");
    expect(mockUpdateAccount).toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalled();
    expect(mockGetProfile).toHaveBeenCalled();
  });

  it("should change password", async () => {
    mockGetPasswordHash.mockResolvedValue({ password_hash: "current-hashed-password" });
    mockVerifyPassword.mockResolvedValue(true);
    mockUpdatePassword.mockResolvedValue(undefined);

    const res = await router.request("/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Password changed successfully");
    expect(mockGetPasswordHash).toHaveBeenCalled();
    expect(mockUpdatePassword).toHaveBeenCalled();
    expect(mockDeleteAllSessionsForAccount).toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalled();
    expect(mockSetSessionCookie).toHaveBeenCalled();
  });

  // Error path tests

  it("should reject profile update with profanity in firstName", async () => {
    mockValidateProfanity.mockReturnValue({
      isClean: false,
      message: "Profanity detected in First name",
    });

    const res = await router.request("/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "badword",
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Profanity detected in First name");
    expect(mockUpdateAccount).not.toHaveBeenCalled();
  });

  it("should reject profile update with profanity in username", async () => {
    mockValidateProfanity
      .mockReturnValueOnce({ isClean: true, message: null })
      .mockReturnValueOnce({ isClean: false, message: "Profanity detected in Username" });

    const res = await router.request("/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "John",
        username: "badword",
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Profanity detected in Username");
    expect(mockUpdateAccount).not.toHaveBeenCalled();
  });

  it("should reject profile update when username already exists", async () => {
    mockValidateProfanity.mockReturnValue({ isClean: true, message: null });
    mockUsernameExists.mockResolvedValue(true);

    const res = await router.request("/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "takenusername",
      }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Username already exists");
    expect(mockUpdateAccount).not.toHaveBeenCalled();
  });

  it("should reject profile update when user record not found", async () => {
    mockValidateProfanity.mockReturnValue({ isClean: true, message: null });
    mockUsernameExists.mockResolvedValue(false);
    mockFindByAccountId.mockResolvedValue(null);

    const res = await router.request("/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Jane",
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.message).toBe("User not found");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("should reject password change when account not found", async () => {
    mockGetPasswordHash.mockResolvedValue(null);

    const res = await router.request("/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.message).toBe("User not found");
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it("should reject password change with incorrect current password", async () => {
    mockGetPasswordHash.mockResolvedValue({ password_hash: "current-hashed-password" });
    mockVerifyPassword.mockResolvedValue(false);

    const res = await router.request("/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "wrongpassword",
        newPassword: "newpassword123",
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Current password is incorrect");
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it("should return success message asking user to re-login if session regeneration fails", async () => {
    mockGetPasswordHash.mockResolvedValue({ password_hash: "current-hashed-password" });
    mockVerifyPassword.mockResolvedValue(true);
    mockUpdatePassword.mockResolvedValue(undefined);
    mockCreateSession.mockRejectedValueOnce(new Error("DB Connection failed"));

    const res = await router.request("/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Password changed successfully. Please log in again.");
    expect(body.sessionRotated).toBe(false);
    expect(mockUpdatePassword).toHaveBeenCalled();
    expect(mockDeleteAllSessionsForAccount).toHaveBeenCalled();
    expect(mockSetSessionCookie).not.toHaveBeenCalled();
  });

  it("should return 500 if deleteAllSessionsForAccount fails", async () => {
    mockGetPasswordHash.mockResolvedValue({ password_hash: "current-hashed-password" });
    mockVerifyPassword.mockResolvedValue(true);
    mockUpdatePassword.mockResolvedValue(undefined);
    mockDeleteAllSessionsForAccount.mockRejectedValueOnce(new Error("DB Connection failed"));

    const res = await router.request("/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: "oldpassword",
        newPassword: "newpassword123",
      }),
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Internal server error");
    expect(mockUpdatePassword).not.toHaveBeenCalled();
    expect(mockDeleteAllSessionsForAccount).toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockSetSessionCookie).not.toHaveBeenCalled();
  });
});
