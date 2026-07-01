import assert from "node:assert/strict";
import test, { mock } from "node:test";
import type { TElection } from "$lib/types";
import type { ElectionCache as TElectionCache } from "./election-cache.svelte";
import type { CacheEntry as TCacheEntry } from "./cache-entry.svelte";

const elections: TElection[] = [
  {
    id: "e1",
    name: "Election 1",
    description: "",
    status: "draft",
    opensAt: 0,
    closesAt: 0,
    createdAt: 0,
    updatedAt: 0,
  },
];

// Stub the API import BEFORE ElectionCache is loaded to prevent static env imports
mock.module("$lib/api/elections", {
  namedExports: {
    listElections: async () => elections,
    getVotingState: async () => ({
      open: null,
      nextDraft: null,
      lastClosed: null,
      myVotes: { electionId: "", votes: [] },
    }),
    getElection: async (id: string) => ({
      id,
      name: "Test Election",
      description: "",
      status: "draft",
      opensAt: 0,
      closesAt: 0,
      createdAt: 0,
      updatedAt: 0,
    }),
  },
});

const { ElectionCache } = await import("./election-cache.svelte");

const entriesOf = (cache: TElectionCache): Map<string, TCacheEntry<TElection>> => {
  // @ts-expect-error - entries is a private Map on ElectionCache
  return cache.entries;
};

test("ElectionCache fetchAll returns data and caches it", async () => {
  const cache = new (ElectionCache as any)();
  const res = await cache.fetchAll();
  assert.deepEqual(res, elections);
});

test("ElectionCache fetch(id) retrieves single election and caches it", async () => {
  const cache = new (ElectionCache as any)();
  const res = await cache.fetch("e1");
  assert.equal(res?.id, "e1");
  assert.equal(cache.getOne("e1")?.id, "e1");
  assert.equal(entriesOf(cache).has("e1"), true);
});

test("ElectionCache.invalidate clears all entries", async () => {
  const cache = new (ElectionCache as any)();
  await cache.fetch("e1");
  assert.equal(entriesOf(cache).has("e1"), true);
  cache.invalidate();
  assert.equal(entriesOf(cache).has("e1"), false);
  assert.equal(cache.getOne("e1"), null);
});
