import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { TCandidate } from "$lib/types";
import type { CandidateCache as TCandidateCache } from "./candidate-cache.svelte";
import type { CacheEntry as TCacheEntry } from "./cache-entry.svelte";

// Stub the API import BEFORE CandidateCache is loaded — its top-level
// `import { allCandidates } from "$lib/api/candidates"` transitively pulls
// in `$env/static/public` (a SvelteKit virtual module), which tsx can't
// resolve. The mock short-circuits the entire chain.
mock.module("$lib/api/candidates", {
  namedExports: {
    allCandidates: async (_opts: { electionId: string }) => ({
      data: [],
      meta: { total: 0, page: 1, limit: 0, totalPages: 1 },
    }),
  },
});

const { CandidateCache } = await import("./candidate-cache.svelte");
const { CacheEntry } = await import("./cache-entry.svelte");

const candidates: TCandidate[] = [
  {
    id: "c1",
    fullName: "Alice",
    accountId: "a1",
    positionId: "p1",
    manifesto: "",
    isActive: 1,
    imageUrl: null,
  },
];

const otherCandidates: TCandidate[] = [
  {
    id: "c2",
    fullName: "Bob",
    accountId: "a2",
    positionId: "p2",
    manifesto: "",
    isActive: 1,
    imageUrl: null,
  },
];

const entriesOf = (cache: TCandidateCache): Map<string, TCacheEntry<TCandidate[]>> => {
  // @ts-expect-error - byElection is a private Map on CandidateCache
  return cache.byElection;
};

const seedEntry = (cache: TCandidateCache, key: string, data: TCandidate[]): void => {
  const entry = new (CacheEntry as any)(async () => data) as TCacheEntry<TCandidate[]>;
  entry.data = data;
  entriesOf(cache).set(key, entry);
};

test("CandidateCache.fetch caches by electionId alone", async () => {
  const cache = new (CandidateCache as new () => any)();
  // Seed the entry under the key CandidateCache.fetch builds when only
  // electionId is supplied: "e1".
  seedEntry(cache, "e1", candidates);
  const result = await cache.fetch("e1");
  assert.deepEqual(result, candidates);
});

test("CandidateCache.fetch caches by electionId:positionId when positionId is given", async () => {
  const cache = new (CandidateCache as new () => any)();
  seedEntry(cache, "e1:p1", candidates);
  seedEntry(cache, "e1:p2", otherCandidates);

  const a = await cache.fetch("e1", "p1");
  const b = await cache.fetch("e1", "p2");

  assert.deepEqual(a, candidates);
  assert.deepEqual(b, otherCandidates);
});

test("CandidateCache.fetch appends 'inactive' to the key when includeInactive is true", async () => {
  const cache = new (CandidateCache as new () => any)();
  const inactiveCandidates: TCandidate[] = [{ ...candidates[0], isActive: 0 }];
  seedEntry(cache, "e1:p1:inactive", inactiveCandidates);

  const result = await cache.fetch("e1", "p1", false, true);
  assert.deepEqual(result, inactiveCandidates);
});

test("CandidateCache.fetch returns the cached value on a second call without force", async () => {
  const cache = new (CandidateCache as new () => any)();
  seedEntry(cache, "e1", candidates);
  const a = await cache.fetch("e1");
  const b = await cache.fetch("e1");
  assert.deepEqual(a, candidates);
  assert.deepEqual(b, candidates);
});

test("CandidateCache.invalidate(electionId) removes only entries whose key starts with that id", () => {
  const cache = new (CandidateCache as new () => any)();
  seedEntry(cache, "e1", candidates);
  seedEntry(cache, "e1:p1", candidates);
  seedEntry(cache, "e2:p2", otherCandidates);

  cache.invalidate("e1");

  assert.equal(entriesOf(cache).has("e1"), false);
  assert.equal(entriesOf(cache).has("e1:p1"), false);
  // e2 is unaffected
  assert.equal(entriesOf(cache).has("e2:p2"), true);
});

test("CandidateCache.invalidate() with no arg clears every entry", () => {
  const cache = new (CandidateCache as new () => any)();
  seedEntry(cache, "e1", candidates);
  seedEntry(cache, "e1:p1:inactive", candidates);
  seedEntry(cache, "e2:p2", otherCandidates);

  cache.invalidate();

  assert.equal(entriesOf(cache).size, 0);
});

test("CandidateCache.invalidate(electionId) on a missing key is a no-op", () => {
  const cache = new (CandidateCache as new () => any)();
  // Should not throw
  cache.invalidate("nonexistent");
  assert.equal(entriesOf(cache).size, 0);
});
