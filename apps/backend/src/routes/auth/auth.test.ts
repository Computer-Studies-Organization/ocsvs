import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock createRouter to include a logger middleware
const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("@/lib/create-app", async (importOriginal) => {
  const { OpenAPIHono } = await import("@hono/zod-openapi");
  const original = await importOriginal<typeof import("@/lib/create-app")>();
  return {
    ...original,
    createRouter: () => {
      const app = new OpenAPIHono({ strict: false });
      // Inject logger so handlers that access c.var.logger don't throw
      app.use("*", async (c: any, next: any) => {
        c.env ??= {};
        if (!c.env.NODE_ENV) {
          Object.assign(c.env, { NODE_ENV: "test", TURNSTILE_SECRET_KEY: "test-secret" });
        }
        c.set("logger", mockLogger);
        await next();
      });
      return app;
    },
  };
});

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
const mockDb: any = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue([]),
      })),
      get: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue([]),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      run: vi.fn(),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      run: vi.fn(),
    })),
  })),
  transaction: vi.fn(async (cb) => await cb(mockDb)),
};

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

// Mock the user account queries
const { mockFindByStudentId, mockUpdateAccount } = vi.hoisted(() => ({
  mockFindByStudentId: vi.fn(),
  mockUpdateAccount: vi.fn(),
}));

vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: {
    findByStudentId: mockFindByStudentId,
    updateAccount: mockUpdateAccount,
    listForAdmin: vi.fn(),
    findById: vi.fn(),
    getAccountDeleteStatus: vi.fn(),
    getProfile: vi.fn(),
  },
}));

// Mock the login-attempt repository (per-identifier lockout layer)
const { mockGetRecentAttempts, mockRecordAttempt, mockClearAttempts, mockDeleteExpiredAttempts } =
  vi.hoisted(() => ({
    mockGetRecentAttempts: vi.fn(),
    mockRecordAttempt: vi.fn(),
    mockClearAttempts: vi.fn(),
    mockDeleteExpiredAttempts: vi.fn(),
  }));

vi.mock("@/database/repositories/login-attempt.repository", () => ({
  loginAttemptRepo: {
    getRecentAttempts: mockGetRecentAttempts,
    recordAttempt: mockRecordAttempt,
    clearAttempts: mockClearAttempts,
    deleteExpiredAttempts: mockDeleteExpiredAttempts,
  },
}));

// Mock password functions
const { mockVerifyPassword, mockIsPasswordHashSupported } = vi.hoisted(() => ({
  mockVerifyPassword: vi.fn(),
  mockIsPasswordHashSupported: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed-password"),
  verifyPassword: mockVerifyPassword,
  isPasswordHashSupported: mockIsPasswordHashSupported,
  needsRehash: vi.fn().mockReturnValue(false),
  CURRENT_COST_DUMMY_HASH:
    "pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
}));

// Mock session functions
const { mockCreateSession, mockGetSessionIdFromCookie, mockDeleteSession } = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockGetSessionIdFromCookie: vi.fn(),
  mockDeleteSession: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  createSession: mockCreateSession,
  setSessionCookie: vi.fn(),
  clearSessionCookie: vi.fn(),
  getSessionIdFromCookie: mockGetSessionIdFromCookie,
  deleteSession: mockDeleteSession,
}));

// Mock the rate-limit middleware so the router can import it
vi.mock("@/middleware/rate-limit", () => ({
  createIpRateLimiter: () => async (_c: any, next: any) => {
    await next();
  },
  getClientIp: () => "1.2.3.4",
}));

// Import router AFTER all mocks are set up
const { default: router } = await import("./auth.index");

describe("auth Routes", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: no prior failed attempts, so existing login tests pass through the lockout check.
    mockGetRecentAttempts.mockResolvedValue([]);
    mockDeleteExpiredAttempts.mockResolvedValue(undefined);

    // Mock fetch for Turnstile
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should login a user", async () => {
    mockFindByStudentId.mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
      password_hash: "hashed-password",
      deletedAt: null,
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({
      id: "session-id",
      expiresAt: Date.now() + 86400000,
    });

    const res = await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("User logged in successfully");
    expect(body.user.username).toBe("testuser");
    expect(mockFindByStudentId).toHaveBeenCalled();
    expect(mockUpdateAccount).toHaveBeenCalledWith(expect.anything(), "test-user-id", {
      lastLogin: expect.any(Number),
    });
    expect(mockCreateSession).toHaveBeenCalled();
    expect(mockUpdateAccount.mock.invocationCallOrder[0]).toBeLessThan(
      mockCreateSession.mock.invocationCallOrder[0],
    );
  });

  it("bounds Turnstile verification with a 10-second timeout", async () => {
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: false }),
    } as Response);
    globalThis.fetch = fetchMock;

    await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ signal: timeoutSignal }),
    );
    timeoutSpy.mockRestore();
  });

  it("should logout a user", async () => {
    mockGetSessionIdFromCookie.mockReturnValue("session-id");
    mockDeleteSession.mockResolvedValue(undefined);

    const res = await router.request("/logout", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Logged out successfully");
    expect(mockGetSessionIdFromCookie).toHaveBeenCalled();
    expect(mockDeleteSession).toHaveBeenCalled();
  });

  it("should return current user from /me", async () => {
    const res = await router.request("/me", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.id).toBe("test-user-id");
    expect(body.user.username).toBe("testuser");
    expect(body.user.role).toBe("user");
  });

  it("should reject login when user not found", async () => {
    mockFindByStudentId.mockResolvedValue(null);

    const res = await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Invalid credentials");
    expect(mockFindByStudentId).toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("should reject login when user is deleted", async () => {
    mockFindByStudentId.mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
      password_hash: "hashed-password",
      deletedAt: Date.now(),
    });

    const res = await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Invalid credentials");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("should reject login with wrong password", async () => {
    mockFindByStudentId.mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
      password_hash: "hashed-password",
      deletedAt: null,
    });
    mockVerifyPassword.mockResolvedValue(false);

    const res = await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "wrongpassword",
        turnstileToken: "mock-token",
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Invalid credentials");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("should block login when 5 recent failed attempts exist (lockout)", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetRecentAttempts.mockResolvedValue([
      { attemptedAt: now - 800 },
      { attemptedAt: now - 700 },
      { attemptedAt: now - 600 },
      { attemptedAt: now - 500 },
      { attemptedAt: now - 400 },
    ]);

    const res = await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).not.toBeNull();
    const body = (await res.json()) as any;
    expect(body.message).toBe("Too many failed login attempts. Please try again later.");
    // Must NOT have looked up the user or attempted a session
    expect(mockFindByStudentId).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("should record a failed attempt when login fails (user not found)", async () => {
    mockGetRecentAttempts.mockResolvedValue([]);
    mockFindByStudentId.mockResolvedValue(null);

    await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(mockRecordAttempt).toHaveBeenCalledTimes(1);
    expect(mockRecordAttempt).toHaveBeenCalledWith(
      expect.anything(),
      "C23-01-1234-CSA001",
      expect.any(String),
    );
  });

  it("should record a failed attempt when the password is wrong", async () => {
    mockGetRecentAttempts.mockResolvedValue([]);
    mockFindByStudentId.mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
      password_hash: "hashed-password",
      deletedAt: null,
    });
    mockVerifyPassword.mockResolvedValue(false);

    await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "wrongpassword",
        turnstileToken: "mock-token",
      }),
    });

    expect(mockRecordAttempt).toHaveBeenCalledTimes(1);
  });

  it("should clear attempts on successful login", async () => {
    mockGetRecentAttempts.mockResolvedValue([]);
    mockFindByStudentId.mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
      password_hash: "hashed-password",
      deletedAt: null,
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({
      id: "session-id",
      expiresAt: Date.now() + 86400000,
    });

    await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(mockClearAttempts).toHaveBeenCalledTimes(1);
    expect(mockRecordAttempt).not.toHaveBeenCalled();
  });

  it("should logout successfully even without active session", async () => {
    mockGetSessionIdFromCookie.mockReturnValue(null);

    const res = await router.request("/logout", {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Logged out successfully");
    expect(mockDeleteSession).not.toHaveBeenCalled();
  });

  it("should reject login when Turnstile validation fails", async () => {
    // Mock fetch to return success: false
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: false }),
    } as Response);

    const res = await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "invalid-token",
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Security verification failed. Please try again.");
    expect(mockFindByStudentId).not.toHaveBeenCalled();
  });

  it("should fail login when Turnstile service throws an error", async () => {
    // Mock fetch to throw error
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const res = await router.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentNumber: "C23-01-1234-CSA001",
        password: "password123",
        turnstileToken: "mock-token",
      }),
    });

    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Verification service temporarily unavailable");
    expect(mockFindByStudentId).not.toHaveBeenCalled();
  });

  it("should fail closed in production when TURNSTILE_SECRET_KEY is missing", async () => {
    const res = await router.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: "C23-01-1234-CSA001",
          password: "password123",
          turnstileToken: "mock-token",
        }),
      },
      {
        NODE_ENV: "production",
        // TURNSTILE_SECRET_KEY is undefined
      },
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toBe("Verification service temporarily unavailable");
    expect(mockFindByStudentId).not.toHaveBeenCalled();
  });

  it("logs in offline without a Turnstile token or network request", async () => {
    mockFindByStudentId.mockResolvedValue({
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
      password_hash: "hashed-password",
      deletedAt: null,
    });
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSession.mockResolvedValue({
      id: "session-id",
      expiresAt: Date.now() + 86400000,
    });

    const res = await router.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: "C23-01-1234-CSA001",
          password: "password123",
        }),
      },
      { NODE_ENV: "development", OFFLINE_DEV: true },
    );

    expect(res.status).toBe(200);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects an online login without a Turnstile token before fetching", async () => {
    const res = await router.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: "C23-01-1234-CSA001",
          password: "password123",
        }),
      },
      { NODE_ENV: "development", TURNSTILE_SECRET_KEY: "test-secret" },
    );

    expect(res.status).toBe(400);
    expect((await res.json()) as any).toMatchObject({
      message: "Security verification failed. Please try again.",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not allow offline bypass in production", async () => {
    const res = await router.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentNumber: "C23-01-1234-CSA001",
          password: "password123",
        }),
      },
      { NODE_ENV: "production", OFFLINE_DEV: true },
    );

    expect(res.status).toBe(500);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(mockFindByStudentId).not.toHaveBeenCalled();
  });
});
