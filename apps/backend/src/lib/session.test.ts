import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  getSession,
  getSessionAccount,
  deleteSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionIdFromCookie,
} from "./session";
import { sessions, accounts } from "@/database/schema";

describe("session utilities", () => {
  let mockDb: any;
  let insertChain: any;
  let selectChain: any;
  let deleteChain: any;

  beforeEach(() => {
    vi.clearAllMocks();

    insertChain = {
      values: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({} as any),
    };

    selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn(),
    };

    deleteChain = {
      where: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({} as any),
    };

    mockDb = {
      insert: vi.fn().mockReturnValue(insertChain),
      select: vi.fn().mockReturnValue(selectChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    };
  });

  describe("createSession", () => {
    it("should insert a new session and return session data", async () => {
      const accountId = "test-account-id";
      const session = await createSession(mockDb, accountId);

      expect(session.id).toBeDefined();
      expect(session.accountId).toBe(accountId);
      expect(session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

      expect(mockDb.insert).toHaveBeenCalledWith(sessions);
      expect(insertChain.values).toHaveBeenCalledWith({
        id: session.id,
        accountId: session.accountId,
        expiresAt: session.expiresAt,
      });
      expect(insertChain.run).toHaveBeenCalledTimes(1);
    });
  });

  describe("getSession", () => {
    it("should retrieve a valid session", async () => {
      const sessionId = "test-session-id";
      const expectedSessionRow = {
        id: sessionId,
        accountId: "test-account-id",
        expiresAt: Math.floor(Date.now() / 1000) + 1000,
      };
      selectChain.get.mockResolvedValue(expectedSessionRow);

      const session = await getSession(mockDb, sessionId);

      expect(session).toEqual(expectedSessionRow);
      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(selectChain.from).toHaveBeenCalledWith(sessions);
      expect(selectChain.where).toHaveBeenCalledTimes(1);
      expect(selectChain.get).toHaveBeenCalledTimes(1);
    });

    it("should return null if session is not found or expired", async () => {
      selectChain.get.mockResolvedValue(undefined);

      const session = await getSession(mockDb, "non-existent");
      expect(session).toBeNull();
    });
  });

  describe("getSessionAccount", () => {
    it("should retrieve a session joined with account information", async () => {
      const sessionId = "test-session-id";
      const expectedResult = {
        session: { expiresAt: 12345 },
        account: {
          id: "acc-id",
          email: "test@example.com",
          username: "testuser",
          role: "user",
        },
      };
      selectChain.get.mockResolvedValue(expectedResult);

      const result = await getSessionAccount(mockDb, sessionId);

      expect(result).toEqual(expectedResult);
      expect(mockDb.select).toHaveBeenCalledWith({
        session: { expiresAt: sessions.expiresAt },
        account: {
          id: accounts.id,
          email: accounts.email,
          username: accounts.username,
          role: accounts.role,
        },
      });
      expect(selectChain.from).toHaveBeenCalledWith(sessions);
      expect(selectChain.innerJoin).toHaveBeenCalledTimes(1);
      expect(selectChain.where).toHaveBeenCalledTimes(1);
      expect(selectChain.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteSession", () => {
    it("should delete session by ID", async () => {
      const sessionId = "test-session-id";
      await deleteSession(mockDb, sessionId);

      expect(mockDb.delete).toHaveBeenCalledWith(sessions);
      expect(deleteChain.where).toHaveBeenCalledTimes(1);
      expect(deleteChain.run).toHaveBeenCalledTimes(1);
    });
  });

  describe("setSessionCookie", () => {
    it("should set Lax and HttpOnly cookie headers", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "development" },
      } as any;
      const sessionId = "test-session-id";
      const expiresAt = 1234567890;

      setSessionCookie(c, sessionId, expiresAt);

      expect(c.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining(
          "session_id=test-session-id; Path=/; HttpOnly; SameSite=Lax; Expires=",
        ),
      );
      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.not.stringContaining("Secure"));
    });

    it("should include Secure attribute in production", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "production" },
      } as any;

      setSessionCookie(c, "test-session-id", 1234567890);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    });

    it("should include Secure attribute in production even when request protocol is plain HTTP", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "production" },
        req: { url: "http://localhost:8787/api/auth/login" },
      } as any;

      setSessionCookie(c, "test-session-id", 1234567890);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    });

    it("should omit Secure attribute in development over plain HTTP", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "development" },
        req: { url: "http://localhost:8787/api/auth/login" },
      } as any;

      setSessionCookie(c, "test-session-id", 1234567890);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.not.stringContaining("Secure"));
    });
  });

  describe("clearSessionCookie", () => {
    it("should set Set-Cookie header with past date to clear cookie", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "development" },
      } as any;

      clearSessionCookie(c);

      expect(c.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining(
          "session_id=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
        ),
      );
    });

    it("should include Secure attribute in production when clearing cookie", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "production" },
        req: { url: "http://localhost:8787/api/auth/logout" },
      } as any;

      clearSessionCookie(c);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"));
    });
  });

  describe("getSessionIdFromCookie", () => {
    it("should extract session ID from cookies", () => {
      const mockReq = {
        header: vi
          .fn()
          .mockReturnValue("other_cookie=value; session_id=test-session-id; third=abc"),
      };
      const c = { req: mockReq } as any;

      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBe("test-session-id");
      expect(mockReq.header).toHaveBeenCalledWith("Cookie");
    });

    it("should return undefined if Cookie header is missing", () => {
      const mockReq = {
        header: vi.fn().mockReturnValue(undefined),
      };
      const c = { req: mockReq } as any;

      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBeUndefined();
    });

    it("should return undefined if session_id cookie is not in header", () => {
      const mockReq = {
        header: vi.fn().mockReturnValue("other_cookie=value; hello=world"),
      };
      const c = { req: mockReq } as any;

      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBeUndefined();
    });

    it("should return undefined if req is missing from context", () => {
      const c = {} as any;
      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBeUndefined();
    });
  });
});
