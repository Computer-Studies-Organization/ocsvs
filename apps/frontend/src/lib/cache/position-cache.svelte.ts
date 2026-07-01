import type { TPosition } from "$lib/types";
import { listPositions } from "$lib/api/positions";
import { CacheEntry } from "./cache-entry.svelte";

export class PositionCache {
  private entries = $state<Map<string, CacheEntry<TPosition[]>>>(new Map());

  async fetch(electionId: string, force?: boolean): Promise<TPosition[] | null> {
    let entry = this.entries.get(electionId);
    if (!entry) {
      entry = new CacheEntry(() => listPositions(electionId));
      this.entries.set(electionId, entry);
    }
    return entry.fetch(force);
  }

  getPositions(electionId: string): TPosition[] | null {
    return this.entries.get(electionId)?.data ?? null;
  }

  invalidate(electionId?: string) {
    if (electionId) {
      this.entries.get(electionId)?.invalidate();
      this.entries.delete(electionId);
    } else {
      this.entries.clear();
    }
  }
}
