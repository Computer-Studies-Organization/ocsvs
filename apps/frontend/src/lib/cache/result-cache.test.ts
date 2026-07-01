import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { TResults } from "$lib/types";
import type { ResultCache as TResultCache } from "./result-cache.svelte";
import type { CacheEntry as TCacheEntry } from "./cache-entry.svelte";

// Stub the API import BEFORE ResultCache is loaded — its top-level
// `import { listResults } from "$lib/api/elections"` transitively pulls
// in `$env/static/public` (a SvelteKit virtual module), which tsx can't
// resolve. The mock short-circuits the entire chain.
mock.module("$lib/api/elections", {
  namedExports: {
    listResults: async (_electionId: string) => [],
  },
});

const { ResultCache } = await import("./result-cache.svelte");
const { CacheEntry } = await import("./cache-entry.svelte");

const results: TResults = [
  {
    positionId: "p1",
    positionName: "President",
    totalVotes: 3,
    candidates: [
      { candidateId: "c1", fullName: "Alice", voteCount: 2, percentage: 66.7 },
      { candidateId: "c2", fullName: "Bob", voteCount: 1, percentage: 33.3 },
    ],
  },
];

const otherResults: TResults = [
  {
    positionId: "p2",
    positionName: "Vice",
    totalVotes: 1,
    candidates: [{ candidateId: "c3", fullName: "Carol", voteCount: 1, percentage: 100 }],
  },
];

const entriesOf = (cache: TResultCache): Map<string, TCacheEntry<TResults>> => {
  // @ts-expect-error - byElection is a private Map on ResultCache
  return cache.byElection;
};

const seedEntry = (cache: TResultCache, electionId: string, data: TResults): void => {
  const entry = new (CacheEntry as any)(async () => data) as TCacheEntry<TResults>;
  entry.data = data;
  entriesOf(cache).set(electionId, entry);
};

test("ResultCache.fetch returns cached results for the given electionId", async () => {
  const cache = new (ResultCache as new () => any)();
  seedEntry(cache, "e1", results);

  const result = await cache.fetch("e1");
  assert.deepEqual(result, results);
});

test("ResultCache.fetch scopes by electionId — separate entries don't bleed", async () => {
  const cache = new (ResultCache as new () => any)();
  seedEntry(cache, "e1", results);
  seedEntry(cache, "e2", otherResults);

  const a = await cache.fetch("e1");
  const b = await cache.fetch("e2");

  assert.deepEqual(a, results);
  assert.deepEqual(b, otherResults);
});

test("ResultCache.fetch returns the cached value on repeat calls", async () => {
  const cache = new (ResultCache as new () => any)();
  seedEntry(cache, "e1", results);

  const a = await cache.fetch("e1");
  const b = await cache.fetch("e1");
  assert.deepEqual(a, results);
  assert.deepEqual(b, results);
});

test("ResultCache.invalidate(electionId) removes only that key", () => {
  const cache = new (ResultCache as new () => any)();
  seedEntry(cache, "e1", results);
  seedEntry(cache, "e2", otherResults);

  cache.invalidate("e1");

  assert.equal(entriesOf(cache).has("e1"), false);
  assert.equal(entriesOf(cache).has("e2"), true);
});

test("ResultCache.invalidate() with no arg clears every entry", () => {
  const cache = new (ResultCache as new () => any)();
  seedEntry(cache, "e1", results);
  seedEntry(cache, "e2", otherResults);

  cache.invalidate();

  assert.equal(entriesOf(cache).size, 0);
});

test("ResultCache.invalidate(electionId) on a missing key is a no-op", () => {
  const cache = new (ResultCache as new () => any)();
  // Should not throw
  cache.invalidate("nonexistent");
  assert.equal(entriesOf(cache).size, 0);
});
