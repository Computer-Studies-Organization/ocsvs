import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth } from "./auth";
import { getSessionAccount, getSessionIdFromCookie } from "@/lib/session";
import { createDb } from "@/config/db";

vi.mock("@/lib/session", () => ({
  getSessionIdFromCookie: vi.fn(),
  getSessionAccount: vi.fn(),
}));

vi.mock("@/config/db", () => ({
  createDb: vi.fn(),
}));

describe("auth middleware - requireAuth", () => {
  let mockContext: any;
  let mockDb: any;
  let nextMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    nextMock = vi.fn();
    mockContext = {
      json: vi.fn().mockImplementation((body, status) => ({ body, status })),
      set: vi.fn(),
      get: vi.fn(),
    };
    mockDb = {};
    vi.mocked(createDb).mockReturnValue({ db: mockDb });
  });

  it("should return 401 when database role is unrecognized", async () => {
    vi.mocked(getSessionIdFromCookie).mockReturnValue("valid-session-id");
    vi.mocked(getSessionAccount).mockResolvedValue({
      session: { id: "valid-session-id", accountId: "acc-id", expiresAt: 12345 },
      account: {
        id: "acc-id",
        email: "test@example.com",
        username: "testuser",
        role: "invalid_role", // unrecognized role string
      },
    } as any);

    const result = await requireAuth(mockContext, nextMock);

    expect(result).toEqual({
      body: { message: "Session expired or invalid" },
      status: 401,
    });
    expect(nextMock).not.toHaveBeenCalled();
    expect(mockContext.set).not.toHaveBeenCalled();
  });

  it("should successfully set authUser and call next when role is valid", async () => {
    vi.mocked(getSessionIdFromCookie).mockReturnValue("valid-session-id");
    vi.mocked(getSessionAccount).mockResolvedValue({
      session: { id: "valid-session-id", accountId: "acc-id", expiresAt: 12345 },
      account: {
        id: "acc-id",
        email: "test@example.com",
        username: "testuser",
        role: "admin", // recognized role
      },
    } as any);

    await requireAuth(mockContext, nextMock);

    expect(mockContext.set).toHaveBeenCalledWith("authUser", {
      id: "acc-id",
      email: "test@example.com",
      username: "testuser",
      role: "admin",
    });
    expect(nextMock).toHaveBeenCalled();
  });
});
