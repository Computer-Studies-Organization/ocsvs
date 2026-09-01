import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  createSessionIfPasswordUnchanged,
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
      select: vi.fn().mockReturnThis(),
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

  describe("createSessionIfPasswordUnchanged", () => {
    it("creates a session when the expected password hash still matches", async () => {
      insertChain.run.mockResolvedValueOnce({ rowsAffected: 1 });

      const session = await createSessionIfPasswordUnchanged(
        mockDb,
        "test-account-id",
        "expected-hash",
      );

      expect(session?.accountId).toBe("test-account-id");
      expect(insertChain.select).toHaveBeenCalledWith(selectChain);
      expect(insertChain.run).toHaveBeenCalledTimes(1);
    });

    it("does not create a session when the password hash changed", async () => {
      insertChain.run.mockResolvedValueOnce({ rowsAffected: 0 });

      await expect(
        createSessionIfPasswordUnchanged(mockDb, "test-account-id", "old-hash"),
      ).resolves.toBeNull();
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
        expect.stringContaining("session_id=test-session-id; Path=/; Expires="),
        { append: true },
      );
      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("HttpOnly"), {
        append: true,
      });
      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("SameSite=Lax"), {
        append: true,
      });
      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.not.stringContaining("Secure"), {
        append: true,
      });
    });

    it("should include Secure attribute in production", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "production" },
        req: { raw: { headers: new Headers() } },
      } as any;

      setSessionCookie(c, "test-session-id", 1234567890);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"), {
        append: true,
      });
      expect(c.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("__Host-session_id=test-session-id"),
        { append: true },
      );
      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("session_id=;"), {
        append: true,
      });
    });

    it("should include Secure attribute in production even when request protocol is plain HTTP", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "production" },
        req: { url: "http://localhost:8787/api/auth/login", raw: { headers: new Headers() } },
      } as any;

      setSessionCookie(c, "test-session-id", 1234567890);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"), {
        append: true,
      });
    });

    it("should include Secure attribute in staging even when request protocol is plain HTTP", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "staging" },
        req: { url: "http://localhost:8787/api/auth/login", raw: { headers: new Headers() } },
      } as any;

      setSessionCookie(c, "test-session-id", 1234567890);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"), {
        append: true,
      });
    });

    it("should omit Secure attribute in development over plain HTTP", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "development" },
        req: { url: "http://localhost:8787/api/auth/login", raw: { headers: new Headers() } },
      } as any;

      setSessionCookie(c, "test-session-id", 1234567890);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.not.stringContaining("Secure"), {
        append: true,
      });
    });
  });

  describe("clearSessionCookie", () => {
    it("should set Set-Cookie header with past date to clear cookie", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "development" },
        req: { raw: { headers: new Headers() } },
      } as any;

      clearSessionCookie(c);

      expect(c.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining(
          "session_id=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax",
        ),
        { append: true },
      );
    });

    it("should include Secure attribute in production when clearing cookie", () => {
      const c = {
        header: vi.fn(),
        env: { NODE_ENV: "production" },
        req: { url: "http://localhost:8787/api/auth/logout", raw: { headers: new Headers() } },
      } as any;

      clearSessionCookie(c);

      expect(c.header).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Secure"), {
        append: true,
      });
      expect(c.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("__Host-session_id=; Max-Age=0; Path=/;"),
        { append: true },
      );
      expect(c.header).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("session_id=; Max-Age=0; Path=/;"),
        { append: true },
      );
    });
  });

  describe("getSessionIdFromCookie", () => {
    it("should extract session ID from cookies", () => {
      const mockReq = {
        raw: {
          headers: new Headers({
            Cookie: "other_cookie=value; session_id=test-session-id; third=abc",
          }),
        },
      };
      const c = { req: mockReq } as any;

      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBe("test-session-id");
    });

    it("should return undefined if Cookie header is missing", () => {
      const mockReq = {
        raw: { headers: new Headers() },
      };
      const c = { req: mockReq } as any;

      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBeUndefined();
    });

    it("should return undefined if session_id cookie is not in header", () => {
      const mockReq = {
        raw: { headers: new Headers({ Cookie: "other_cookie=value; hello=world" }) },
      };
      const c = { req: mockReq } as any;

      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBeUndefined();
    });

    it("should only read the __Host- cookie in production", () => {
      const mockReq = {
        raw: {
          headers: new Headers({
            Cookie: "session_id=legacy-session-id; __Host-session_id=host-session-id",
          }),
        },
      };
      const c = { req: mockReq, env: { NODE_ENV: "production" } } as any;

      expect(getSessionIdFromCookie(c)).toBe("host-session-id");
    });

    it("should return undefined if req is missing from context", () => {
      const c = {} as any;
      const sessionId = getSessionIdFromCookie(c);
      expect(sessionId).toBeUndefined();
    });
  });
});
