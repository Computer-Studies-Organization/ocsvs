import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, drizzleMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  drizzleMock: vi.fn(),
}));

vi.mock("@libsql/client", () => ({ createClient: createClientMock }));
vi.mock("drizzle-orm/libsql", () => ({ drizzle: drizzleMock }));

import { createDb } from "./index";

describe("createDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockImplementation(() => ({}));
    drizzleMock.mockImplementation(() => ({}));
  });

  it("reuses the database object stored on the request context", () => {
    let cachedDb: unknown;
    const context = {
      env: { TURSO_DATABASE_URL: "libsql://example" },
      get: vi.fn(() => cachedDb),
      set: vi.fn((_key: string, value: unknown) => {
        cachedDb = value;
      }),
    } as any;

    const first = createDb(context).db;
    const second = createDb(context).db;

    expect(second).toBe(first);
    expect(createClientMock).toHaveBeenCalledOnce();
    expect(drizzleMock).toHaveBeenCalledOnce();
    expect(context.set).toHaveBeenCalledWith("db", first);
  });

  it("does not share database objects between request contexts", () => {
    let firstCachedDb: unknown;
    let secondCachedDb: unknown;
    const firstContext = {
      env: { TURSO_DATABASE_URL: "libsql://example" },
      get: vi.fn(() => firstCachedDb),
      set: vi.fn((_key: string, value: unknown) => {
        firstCachedDb = value;
      }),
    } as any;
    const secondContext = {
      env: { TURSO_DATABASE_URL: "libsql://example" },
      get: vi.fn(() => secondCachedDb),
      set: vi.fn((_key: string, value: unknown) => {
        secondCachedDb = value;
      }),
    } as any;

    const first = createDb(firstContext).db;
    const second = createDb(secondContext).db;

    expect(second).not.toBe(first);
    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(drizzleMock).toHaveBeenCalledTimes(2);
  });
});
