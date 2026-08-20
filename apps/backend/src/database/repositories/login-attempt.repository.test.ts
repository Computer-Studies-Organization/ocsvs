import { and, eq, gte } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginAttempts } from "@/database/schema";

const chain: any = {
  values: vi.fn(() => chain),
  from: vi.fn(() => chain),
  where: vi.fn(() => chain),
  orderBy: vi.fn(() => chain),
  get: vi.fn(() => undefined),
  all: vi.fn(() => []),
  run: vi.fn(() => ({ rowsAffected: 1 })),
};

const mockDb = {
  insert: vi.fn(() => chain),
  select: vi.fn(() => chain),
  delete: vi.fn(() => chain),
};

vi.mock("@/config/db", () => ({ createDb: () => ({ db: mockDb }) }));

import { loginAttemptRepo } from "./login-attempt.repository";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("loginAttemptRepo.getRecentAttempts", () => {
  it("returns attempts for only the given identifier and IP address", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T00:00:00Z"));
    chain.all.mockReturnValueOnce([{ attemptedAt: 100 }, { attemptedAt: 200 }]);

    const rows = await loginAttemptRepo.getRecentAttempts(
      mockDb as any,
      "C23-01-1234-CSA001",
      "1.2.3.4",
      900,
    );

    expect(rows).toHaveLength(2);
    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(loginAttempts.identifier, "C23-01-1234-CSA001"),
        eq(loginAttempts.ipAddress, "1.2.3.4"),
        gte(loginAttempts.attemptedAt, Math.floor(Date.now() / 1000) - 900),
      ),
    );
  });

  it("returns an empty array when no attempts exist", async () => {
    chain.all.mockReturnValueOnce([]);
    const rows = await loginAttemptRepo.getRecentAttempts(
      mockDb as any,
      "C23-01-1234-CSA001",
      "1.2.3.4",
      900,
    );
    expect(rows).toEqual([]);
  });
});

describe("loginAttemptRepo.recordAttempt", () => {
  it("inserts a row with id, identifier, attemptedAt, and ipAddress", async () => {
    await loginAttemptRepo.recordAttempt(mockDb as any, "C23-01-1234-CSA001", "1.2.3.4");

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledWith(loginAttempts);
    expect(chain.values).toHaveBeenCalledTimes(1);
    const inserted = chain.values.mock.calls[0]?.[0];
    expect(inserted.identifier).toBe("C23-01-1234-CSA001");
    expect(inserted.ipAddress).toBe("1.2.3.4");
    expect(typeof inserted.id).toBe("string");
    expect(typeof inserted.attemptedAt).toBe("number");
  });
});

describe("loginAttemptRepo.clearAttempts", () => {
  it("deletes all rows for the given identifier", async () => {
    await loginAttemptRepo.clearAttempts(mockDb as any, "C23-01-1234-CSA001");

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledWith(loginAttempts);
    expect(chain.where).toHaveBeenCalledWith(eq(loginAttempts.identifier, "C23-01-1234-CSA001"));
  });
});

describe("loginAttemptRepo.deleteExpiredAttempts", () => {
  it("deletes rows older than the window for the given identifier", async () => {
    await loginAttemptRepo.deleteExpiredAttempts(mockDb as any, "C23-01-1234-CSA001", 900);

    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb.delete).toHaveBeenCalledWith(loginAttempts);
    expect(chain.where).toHaveBeenCalledTimes(1);
  });
});
