import type { TCandidate } from "$lib/types";
import { allCandidates } from "$lib/api/candidates";
import { CacheEntry } from "./cache-entry.svelte";

export class CandidateCache {
  private byElection = $state<Map<string, CacheEntry<TCandidate[]>>>(new Map());

  async fetch(
    electionId: string,
    positionId?: string,
    force?: boolean,
    includeInactive?: boolean,
  ): Promise<TCandidate[] | null> {
    const parts = [electionId];
    if (positionId) parts.push(positionId);
    if (includeInactive) parts.push("inactive");
    const key = parts.join(":");
    let entry = this.byElection.get(key);
    if (!entry) {
      entry = new CacheEntry(async () => {
        const res = await allCandidates({ electionId, positionId, includeInactive });
        return res.data;
      });
      this.byElection.set(key, entry);
    }
    return entry.fetch(force);
  }

  invalidate(electionId?: string) {
    if (electionId) {
      for (const [key, entry] of this.byElection) {
        if (key === electionId || key.startsWith(`${electionId}:`)) {
          entry.invalidate();
          this.byElection.delete(key);
        }
      }
    } else {
      this.byElection.clear();
    }
  }
}
