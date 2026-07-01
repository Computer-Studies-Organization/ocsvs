import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { TPosition } from "$lib/types";
import type { PositionCache as TPositionCache } from "./position-cache.svelte";
import type { CacheEntry as TCacheEntry } from "./cache-entry.svelte";

// Stub the API import BEFORE PositionCache is loaded — its top-level
// `import { listPositions } from "$lib/api/positions"` transitively pulls
// in `$env/static/public` (a SvelteKit virtual module), which tsx can't
// resolve. The mock short-circuits the entire chain.
mock.module("$lib/api/positions", {
  namedExports: {
    listPositions: async (_electionId: string) => [],
  },
});

// Dynamic import so the mock above is in place before PositionCache evaluates.
// We touch `PositionCache` and `CacheEntry` only as values (`new ...`); the
// internal test seam for the private `entries` Map uses `any` because the
// classes are imported via dynamic import (where TypeScript sees them as
// values, not types).
const { PositionCache } = await import("./position-cache.svelte");
const { CacheEntry } = await import("./cache-entry.svelte");

const positions: TPosition[] = [
  { id: "p1", electionId: "e1", name: "President", displayOrder: 1, createdAt: 0, updatedAt: 0 },
];

const otherPositions: TPosition[] = [
  { id: "p2", electionId: "e2", name: "Vice", displayOrder: 1, createdAt: 0, updatedAt: 0 },
];

// Access private field for unit testing validation
const entriesOf = (cache: TPositionCache): Map<string, TCacheEntry<TPosition[]>> => {
  // @ts-expect-error - entries is a private Map on PositionCache
  return cache.entries;
};

const seedEntry = (cache: TPositionCache, electionId: string, data: TPosition[]): void => {
  const entry = new (CacheEntry as any)(async () => data) as TCacheEntry<TPosition[]>;
  entry.data = data;
  entriesOf(cache).set(electionId, entry);
};

test("PositionCache.getPositions returns null when no entry exists", () => {
  const cache = new (PositionCache as new () => any)();
  assert.equal(cache.getPositions("e1"), null);
});

test("PositionCache.getPositions returns data when an entry is populated", () => {
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  assert.deepEqual(cache.getPositions("e1"), positions);
});

test("PositionCache.invalidate(electionId) removes only that key", () => {
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  seedEntry(cache, "e2", otherPositions);

  cache.invalidate("e1");

  assert.equal(cache.getPositions("e1"), null);
  assert.deepEqual(cache.getPositions("e2"), otherPositions);
});

test("PositionCache.invalidate() with no arg clears every entry", () => {
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  seedEntry(cache, "e2", otherPositions);

  cache.invalidate();

  assert.equal(cache.getPositions("e1"), null);
  assert.equal(cache.getPositions("e2"), null);
});

test("PositionCache.invalidate(electionId) on a missing key is a no-op", () => {
  const cache = new (PositionCache as new () => any)();
  // Should not throw
  cache.invalidate("nonexistent");
  assert.equal(cache.getPositions("nonexistent"), null);
});

test("PositionCache.invalidate(electionId) deletes the Map slot", () => {
  // position-cache deletes the CacheEntry from the Map after invalidate,
  // matching CandidateCache / ResultCache semantics. A subsequent fetch()
  // creates a fresh entry with the same in-flight dedupe behaviour.
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  assert.equal(cache.getPositions("e1"), positions);

  cache.invalidate("e1");

  assert.equal(entriesOf(cache).has("e1"), false);
  assert.equal(cache.getPositions("e1"), null);
});
