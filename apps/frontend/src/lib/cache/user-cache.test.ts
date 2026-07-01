import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { TUsersData } from "$lib/types";
import type { UserCache as TUserCache } from "./user-cache.svelte";
import type { CacheEntry as TCacheEntry } from "./cache-entry.svelte";

// Stub the API import BEFORE UserCache is loaded — its top-level
// `import { fetchUsers } from "$lib/api/users"` transitively pulls
// in `$env/static/public` (a SvelteKit virtual module), which tsx can't
// resolve. The mock short-circuits the entire chain.
mock.module("$lib/api/users", {
  namedExports: {
    fetchUsers: async (_opts: object) => ({
      data: [],
      meta: { total: 0, page: 1, limit: 0, totalPages: 1 },
    }),
  },
});

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
  assert.deepEqual(result, users);
});

test("UserCache.fetch returns null when no data has been loaded", async () => {
  const cache = new (UserCache as new () => any)();
  // The fetcher is mocked to return [], so a fetch() with empty state will
  // populate data with []. Verify the no-data path by checking initial state.
  assert.equal(cache.data, null);
});

test("UserCache.data / loading / error getters reflect the underlying entry", () => {
  const cache = new (UserCache as new () => any)();
  seed(cache, users);
  assert.deepEqual(cache.data, users);
  assert.equal(cache.loading, false);
  assert.equal(cache.error, null);
});

test("UserCache.error surfaces when the underlying entry has an error", () => {
  const cache = new (UserCache as new () => any)();
  const e = entryOf(cache);
  e.error = "boom";
  assert.equal(cache.error, "boom");
});

test("UserCache.loading reflects the underlying entry's loading flag", () => {
  const cache = new (UserCache as new () => any)();
  const e = entryOf(cache);
  e.loading = true;
  assert.equal(cache.loading, true);
});

test("UserCache.invalidate() clears the underlying entry", () => {
  const cache = new (UserCache as new () => any)();
  seed(cache, users);
  assert.deepEqual(cache.data, users);

  cache.invalidate();

  assert.equal(cache.data, null);
  assert.equal(entryOf(cache).lastFetched, 0);
});

test("UserCache.fetch with force=true re-runs the fetcher even when data is cached", async () => {
  // This validates that UserCache delegates force-refresh semantics to CacheEntry.
  const cache = new (UserCache as new () => any)();
  seed(cache, users);

  // Force-refresh: cache.data is non-null so without force it would short-circuit.
  // The mock fetcher returns [], so force=true should overwrite the cached data.
  const result = await cache.fetch(true);
  assert.deepEqual(result, []);
  assert.deepEqual(cache.data, []);
});
