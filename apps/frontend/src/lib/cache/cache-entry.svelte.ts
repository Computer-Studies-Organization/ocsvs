/**
 * A single-cache-slot wrapper that tracks a value and its fetch state.
 *
 * **Staleness contract**: this class performs no automatic TTL or background
 * refresh. A cached value is considered "fresh" until either:
 *   - the consumer calls `fetch(force=true)`, or
 *   - the consumer calls `invalidate()`.
 * Caches live for the lifetime of the module (i.e. the browser tab). Code
 * paths that mutate server state MUST call `invalidate()` on every relevant
 * cache after the mutation completes.
 *
 * **In-flight cancellation**: `invalidate()` is synchronous. If a fetch is
 * already in flight when `invalidate()` is called, the in-flight result is
 * discarded (see the `epoch` field) so a stale value cannot re-populate the
 * cache after the caller has explicitly cleared it.
 */
export class CacheEntry<T> {
  data = $state.raw<T | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);

  private fetcher: (options?: { fetch?: typeof fetch }) => Promise<T>;
  private inflight: Promise<T | null> | null = null;
  private failure: unknown = null;
  // Bumped on every invalidate() (and every new fetch). .then/.catch handlers
  // capture the value at fetch-start and discard their result if invalidate()
  // has since bumped the counter — preventing stale fetches from re-populating
  // a cache the caller has explicitly cleared.
  private epoch = 0;

  constructor(fetcher: (options?: { fetch?: typeof fetch }) => Promise<T>) {
    this.fetcher = fetcher;
  }

  async fetch(force = false, options?: { fetch?: typeof fetch }): Promise<T | null> {
    if (!force && this.data !== null) return this.data;

    if (this.inflight && !force) return this.inflight;

    const myEpoch = ++this.epoch;
    this.loading = true;
    this.error = null;
    this.failure = null;

    this.inflight = this.fetcher(options)
      .then((result) => {
        if (myEpoch !== this.epoch) return null;
        this.data = result;
        return result;
      })
      .catch((err) => {
        if (myEpoch !== this.epoch) return null;
        this.failure = err;
        this.error = err?.message ?? "Unknown error";
        return null;
      })
      .finally(() => {
        if (myEpoch !== this.epoch) return;
        this.loading = false;
        this.inflight = null;
      });

    return this.inflight;
  }

  /** Use in route loads where a failed request must not look like missing data. */
  async fetchOrThrow(force = false, options?: { fetch?: typeof fetch }): Promise<T> {
    const result = await this.fetch(force, options);
    if (result !== null) return result;
    throw this.failure ?? new Error(this.error ?? "Failed to fetch data");
  }

  /**
   * Clear the cached value and discard any in-flight fetch result.
   *
   * After this call, `data` is `null` even if a fetch was already running —
   * the in-flight `.then` handler will see that the epoch has advanced and
   * skip its write.
   */
  invalidate(): void {
    this.epoch++;
    this.data = null;
    this.loading = false;
    this.inflight = null;
    this.failure = null;
  }
}
