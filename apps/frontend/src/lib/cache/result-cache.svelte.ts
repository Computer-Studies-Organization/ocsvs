import type { TResults } from "$lib/types";
import { listResults } from "$lib/api/elections";
import { CacheEntry } from "./cache-entry.svelte";

export class ResultCache {
  private byElection = $state<Map<string, CacheEntry<TResults>>>(new Map());

  async fetch(electionId: string, force?: boolean): Promise<TResults | null> {
    let entry = this.byElection.get(electionId);
    if (!entry) {
      entry = new CacheEntry(() => listResults(electionId));
      this.byElection.set(electionId, entry);
    }
    return entry.fetch(force);
  }

  invalidate(electionId?: string) {
    if (electionId) {
      this.byElection.get(electionId)?.invalidate();
      this.byElection.delete(electionId);
    } else {
      this.byElection.clear();
    }
  }
}
