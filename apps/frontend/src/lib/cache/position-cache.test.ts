import { expect, test, vi } from "vitest";
import type { TPosition } from "$lib/types";
import type { PositionCache as TPositionCache } from "./position-cache.svelte";
import type { CacheEntry as TCacheEntry } from "./cache-entry.svelte";

vi.mock("$lib/api/positions", () => ({
  listPositions: async (_electionId: string) => [],
}));

const { PositionCache } = await import("./position-cache.svelte");
const { CacheEntry } = await import("./cache-entry.svelte");

const positions: TPosition[] = [
  { id: "p1", electionId: "e1", name: "President", displayOrder: 1, createdAt: 0, updatedAt: 0 },
];

const otherPositions: TPosition[] = [
  { id: "p2", electionId: "e2", name: "Vice", displayOrder: 1, createdAt: 0, updatedAt: 0 },
];

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
  expect(cache.getPositions("e1")).toBeNull();
});

test("PositionCache.getPositions returns data when an entry is populated", () => {
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  expect(cache.getPositions("e1")).toEqual(positions);
});

test("PositionCache.invalidate(electionId) removes only that key", () => {
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  seedEntry(cache, "e2", otherPositions);

  cache.invalidate("e1");

  expect(cache.getPositions("e1")).toBeNull();
  expect(cache.getPositions("e2")).toEqual(otherPositions);
});

test("PositionCache.invalidate() with no arg clears every entry", () => {
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  seedEntry(cache, "e2", otherPositions);

  cache.invalidate();

  expect(cache.getPositions("e1")).toBeNull();
  expect(cache.getPositions("e2")).toBeNull();
});

test("PositionCache.invalidate(electionId) on a missing key is a no-op", () => {
  const cache = new (PositionCache as new () => any)();
  cache.invalidate("nonexistent");
  expect(cache.getPositions("nonexistent")).toBeNull();
});

test("PositionCache.invalidate(electionId) deletes the Map slot", () => {
  const cache = new (PositionCache as new () => any)();
  seedEntry(cache, "e1", positions);
  expect(cache.getPositions("e1")).toEqual(positions);

  cache.invalidate("e1");

  expect(entriesOf(cache).has("e1")).toBe(false);
  expect(cache.getPositions("e1")).toBeNull();
});
