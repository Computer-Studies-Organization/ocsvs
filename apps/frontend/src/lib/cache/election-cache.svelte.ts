import type { TElection, TVotingState } from "$lib/types";
import { listElections, getVotingState, getElection } from "$lib/api/elections";
import { CacheEntry } from "./cache-entry.svelte";

export class ElectionCache {
  private all = new CacheEntry<TElection[]>(() => listElections());
  private _votingState = new CacheEntry<TVotingState>(() => getVotingState());
  private entries = $state<Map<string, CacheEntry<TElection>>>(new Map());

  get elections() {
    return this.all.data;
  }
  get votingState() {
    return this._votingState.data;
  }
  get loading() {
    return this.all.loading || this._votingState.loading;
  }

  fetchAll(force?: boolean) {
    return this.all.fetch(force);
  }
  fetchVotingState(force?: boolean) {
    return this._votingState.fetch(force);
  }

  async fetch(id: string, force?: boolean): Promise<TElection | null> {
    let entry = this.entries.get(id);
    if (!entry) {
      entry = new CacheEntry(() => getElection(id));
      this.entries.set(id, entry);
    }
    return entry.fetch(force);
  }

  getOne(id: string): TElection | null {
    return this.entries.get(id)?.data ?? null;
  }

  invalidate(): void {
    this.all.invalidate();
    this._votingState.invalidate();
    this.entries.clear();
  }
}
