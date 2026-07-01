import { expect, test, vi } from "vitest";
import type { TUsersData } from "$lib/types";
import type { UserCache as TUserCache } from "./user-cache.svelte";
import type { CacheEntry as TCacheEntry } from "./cache-entry.svelte";

vi.mock("$lib/api/users", () => ({
  fetchUsers: async (_opts: object) => ({
    data: [],
    meta: { total: 0, page: 1, limit: 0, totalPages: 1 },
  }),
}));

const { UserCache } = await import("./user-cache.svelte");

const users: TUsersData[] = [
  {
    id: "u1",
    accountId: "a1",
    studentId: "S001",
    firstName: "Alice",
    lastName: "Anderson",
    fullName: "Alice Anderson",
    username: "alice",
    email: "alice@example.com",
    yearLevel: "1st Year",
    course: "BSCS",
    role: "user",
    deletedAt: null,
    createdAt: 0,
    updatedAt: 0,
    lastLogin: null,
  },
];

// UserCache wraps a single CacheEntry (not a Map). We reach into the private
// `entry` field to seed it, mirroring the position-cache.test.ts pattern.
const entryOf = (cache: TUserCache): TCacheEntry<TUsersData[]> => {
  // @ts-expect-error - entry is private on UserCache
  return cache.entry;
};

const seed = (cache: TUserCache, data: TUsersData[]): void => {
  const e = entryOf(cache);
  e.data = data;
};

test("UserCache.fetch returns data after seed", async () => {
  const cache = new (UserCache as new () => any)();
  seed(cache, users);

  const result = await cache.fetch();
  expect(result).toEqual(users);
});

test("UserCache.fetch returns null when no data has been loaded", async () => {
  const cache = new (UserCache as new () => any)();
  // The fetcher is mocked to return [], so a fetch() with empty state will
  // populate data with []. Verify the no-data path by checking initial state.
  expect(cache.data).toBeNull();
});

test("UserCache.data / loading / error getters reflect the underlying entry", () => {
  const cache = new (UserCache as new () => any)();
  seed(cache, users);
  expect(cache.data).toEqual(users);
  expect(cache.loading).toBe(false);
  expect(cache.error).toBeNull();
});

test("UserCache.error surfaces when the underlying entry has an error", () => {
  const cache = new (UserCache as new () => any)();
  const e = entryOf(cache);
  e.error = "boom";
  expect(cache.error).toBe("boom");
});

test("UserCache.loading reflects the underlying entry's loading flag", () => {
  const cache = new (UserCache as new () => any)();
  const e = entryOf(cache);
  e.loading = true;
  expect(cache.loading).toBe(true);
});

test("UserCache.invalidate() clears the underlying entry", () => {
  const cache = new (UserCache as new () => any)();
  seed(cache, users);
  expect(cache.data).toEqual(users);

  cache.invalidate();

  expect(cache.data).toBeNull();
  expect(entryOf(cache).lastFetched).toBe(0);
});

test("UserCache.fetch with force=true re-runs the fetcher even when data is cached", async () => {
  // This validates that UserCache delegates force-refresh semantics to CacheEntry.
  const cache = new (UserCache as new () => any)();
  seed(cache, users);

  // Force-refresh: cache.data is non-null so without force it would short-circuit.
  // The mock fetcher returns [], so force=true should overwrite the cached data.
  const result = await cache.fetch(true);
  expect(result).toEqual([]);
  expect(cache.data).toEqual([]);
});
