import { expect, test } from "vitest";
import { CacheEntry } from "./cache-entry.svelte";

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

test("CacheEntry starts with null data, false loading, null error", () => {
  const entry = new CacheEntry<number>(async () => 42);
  expect(entry.data).toBeNull();
  expect(entry.loading).toBe(false);
  expect(entry.error).toBeNull();
});

test("CacheEntry.fetch populates data on success and clears loading", async () => {
  const entry = new CacheEntry<number>(async () => 42);
  const result = await entry.fetch();
  expect(result).toBe(42);
  expect(entry.data).toBe(42);
  expect(entry.loading).toBe(false);
  expect(entry.error).toBeNull();
  expect(entry.lastFetched).toBeGreaterThan(0);
});

test("CacheEntry.fetch captures error message and returns null", async () => {
  const entry = new CacheEntry<number>(async () => {
    throw new Error("boom");
  });
  const result = await entry.fetch();
  expect(result).toBeNull();
  expect(entry.data).toBeNull();
  expect(entry.error).toBe("boom");
  expect(entry.loading).toBe(false);
});

test("CacheEntry.fetch uses fallback message when error has no message", async () => {
  const entry = new CacheEntry<number>(async () => {
    throw "plain string thrown";
  });
  await entry.fetch();
  expect(entry.error).toBe("Unknown error");
});

test("CacheEntry.fetch dedupes concurrent calls (only one underlying fetch)", async () => {
  let calls = 0;
  const entry = new CacheEntry<number>(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return calls;
  });

  const [a, b, c] = await Promise.all([entry.fetch(), entry.fetch(), entry.fetch()]);
  expect(calls).toBe(1);
  expect(a).toBe(1);
  expect(b).toBe(1);
  expect(c).toBe(1);
  expect(entry.data).toBe(1);
});

test("CacheEntry.fetch with force=true bypasses cached data and re-fetches", async () => {
  let value = 1;
  const entry = new CacheEntry<number>(async () => value);

  await entry.fetch();
  expect(entry.data).toBe(1);

  value = 2;
  const second = await entry.fetch();
  expect(second).toBe(1);
  expect(entry.data).toBe(1);

  const third = await entry.fetch(true);
  expect(third).toBe(2);
  expect(entry.data).toBe(2);
});

test("CacheEntry.invalidate clears data and lastFetched but not a prior error", () => {
  const entry = new CacheEntry<number>(async () => 1);
  entry.data = 1;
  entry.lastFetched = Date.now();
  entry.invalidate();
  expect(entry.data).toBeNull();
  expect(entry.lastFetched).toBe(0);
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
  expect(entry.data).toBeNull();

  entry.invalidate();
  expect(entry.data).toBeNull();
  expect(entry.lastFetched).toBe(0);

  resolve(42);
  await fetchPromise;

  expect(entry.data).toBeNull();
  expect(entry.lastFetched).toBe(0);
  expect(entry.error).toBeNull();
});

test("CacheEntry.fetch after invalidate during in-flight runs a fresh fetch", async () => {
  let calls = 0;
  let resolveFirst!: (v: number) => void;
  const entry = new CacheEntry<number>(() => {
    calls += 1;
    if (calls === 1) {
      return new Promise<number>((r) => {
        resolveFirst = r;
      });
    }
    return Promise.resolve(7);
  });

  const first = entry.fetch();
  expect(calls).toBe(1);

  entry.invalidate();

  const second = entry.fetch();
  expect(calls).toBe(2);
  expect(await second).toBe(7);

  resolveFirst(42);
  await first;
  expect(entry.data).toBe(7);
  expect(entry.error).toBeNull();
});

test("CacheEntry.fetch after a failure clears the previous error on the next success", async () => {
  let shouldFail = true;
  const entry = new CacheEntry<number>(async () => {
    if (shouldFail) throw new Error("first attempt fails");
    return 99;
  });

  await entry.fetch();
  expect(entry.error).toBe("first attempt fails");

  shouldFail = false;
  await entry.fetch(true);
  expect(entry.error).toBeNull();
  expect(entry.data).toBe(99);
});

test("CacheEntry error path leaves inflight cleared so a later fetch can run", async () => {
  const entry = new CacheEntry<number>(async () => {
    throw new Error("x");
  });
  await entry.fetch();
  await flushMicrotasks();
  expect(entry.error).toBe("x");

  const ok = new CacheEntry<number>(async () => 7);
  await ok.fetch();
  expect(ok.error).toBeNull();
  expect(ok.data).toBe(7);
});

test("CacheEntry.fetch forwards custom options to the fetcher", async () => {
  let passedOpts: any = null;
  const entry = new CacheEntry<number>(async (opts) => {
    passedOpts = opts;
    return 42;
  });

  const dummyFetch = () => Promise.resolve(new Response());
  await entry.fetch(false, { fetch: dummyFetch as any });
  expect(passedOpts).toEqual({ fetch: dummyFetch });
});
