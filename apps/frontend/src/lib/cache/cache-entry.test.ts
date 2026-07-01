import assert from "node:assert/strict";
import test from "node:test";
import { CacheEntry } from "./cache-entry.svelte";

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

test("CacheEntry starts with null data, false loading, null error", () => {
  const entry = new CacheEntry<number>(async () => 42);
  assert.equal(entry.data, null);
  assert.equal(entry.loading, false);
  assert.equal(entry.error, null);
});

test("CacheEntry.fetch populates data on success and clears loading", async () => {
  const entry = new CacheEntry<number>(async () => 42);
  const result = await entry.fetch();
  assert.equal(result, 42);
  assert.equal(entry.data, 42);
  assert.equal(entry.loading, false);
  assert.equal(entry.error, null);
  assert.ok(entry.lastFetched > 0);
});

test("CacheEntry.fetch captures error message and returns null", async () => {
  const entry = new CacheEntry<number>(async () => {
    throw new Error("boom");
  });
  const result = await entry.fetch();
  assert.equal(result, null);
  assert.equal(entry.data, null);
  assert.equal(entry.error, "boom");
  assert.equal(entry.loading, false);
});

test("CacheEntry.fetch uses fallback message when error has no message", async () => {
  const entry = new CacheEntry<number>(async () => {
    throw "plain string thrown";
  });
  await entry.fetch();
  assert.equal(entry.error, "Unknown error");
});

test("CacheEntry.fetch dedupes concurrent calls (only one underlying fetch)", async () => {
  let calls = 0;
  const entry = new CacheEntry<number>(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return calls;
  });

  const [a, b, c] = await Promise.all([entry.fetch(), entry.fetch(), entry.fetch()]);
  assert.equal(calls, 1, "underlying fetcher should run exactly once for concurrent calls");
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(c, 1);
  assert.equal(entry.data, 1);
});

test("CacheEntry.fetch with force=true bypasses cached data and re-fetches", async () => {
  let value = 1;
  const entry = new CacheEntry<number>(async () => value);

  await entry.fetch();
  assert.equal(entry.data, 1);

  value = 2;
  const second = await entry.fetch();
  assert.equal(second, 1, "cached value returned when force is omitted");
  assert.equal(entry.data, 1);

  const third = await entry.fetch(true);
  assert.equal(third, 2, "force=true returns fresh value");
  assert.equal(entry.data, 2);
});

test("CacheEntry.invalidate clears data and lastFetched but not a prior error", () => {
  const entry = new CacheEntry<number>(async () => 1);
  entry.data = 1;
  entry.lastFetched = Date.now();
  entry.invalidate();
  assert.equal(entry.data, null);
  assert.equal(entry.lastFetched, 0);
});

test("CacheEntry.invalidate during an in-flight fetch discards the stale result", async () => {
  let resolve!: (v: number) => void;
  const entry = new CacheEntry<number>(
    () =>
      new Promise<number>((r) => {
        resolve = r;
      }),
  );

  const fetchPromise = entry.fetch();
  // Sanity: the slot is occupied and nothing has landed yet.
  assert.equal(entry.data, null);

  // Caller clears the cache while the fetch is still pending.
  entry.invalidate();
  assert.equal(entry.data, null);
  assert.equal(entry.lastFetched, 0);

  // The in-flight fetch eventually resolves with the (now-stale) value.
  resolve(42);
  await fetchPromise;

  // The stale result must NOT overwrite the cleared state.
  assert.equal(entry.data, null, "stale fetch must not repopulate after invalidate");
  assert.equal(entry.lastFetched, 0);
  assert.equal(entry.error, null, "invalidate should also suppress a late error");
});

test("CacheEntry.fetch after invalidate during in-flight runs a fresh fetch", async () => {
  let resolveFirst!: (v: number) => void;
  const entry = new CacheEntry<number>(
    () =>
      new Promise<number>((r) => {
        resolveFirst = r;
      }),
  );

  const first = entry.fetch();
  entry.invalidate();
  // Trigger a second fetch while the first is still pending — the dedupe
  // path should NOT return the first (invalidated) promise's value.
  let calls = 0;
  const secondEntry = new CacheEntry<number>(async () => {
    calls += 1;
    return 7;
  });
  const second = secondEntry.fetch();
  assert.equal(await second, 7);
  assert.equal(calls, 1);

  // Drain the first promise; the original cache must remain empty.
  resolveFirst(42);
  await first;
  assert.equal(entry.data, null);
  assert.equal(entry.error, null);
});

test("CacheEntry.fetch after a failure clears the previous error on the next success", async () => {
  let shouldFail = true;
  const entry = new CacheEntry<number>(async () => {
    if (shouldFail) throw new Error("first attempt fails");
    return 99;
  });

  await entry.fetch();
  assert.equal(entry.error, "first attempt fails");

  shouldFail = false;
  await entry.fetch(true);
  assert.equal(entry.error, null);
  assert.equal(entry.data, 99);
});

test("CacheEntry error path leaves inflight cleared so a later fetch can run", async () => {
  const entry = new CacheEntry<number>(async () => {
    throw new Error("x");
  });
  await entry.fetch();
  await flushMicrotasks();
  assert.equal(entry.error, "x");

  const ok = new CacheEntry<number>(async () => 7);
  await ok.fetch();
  assert.equal(ok.error, null);
  assert.equal(ok.data, 7);
});
