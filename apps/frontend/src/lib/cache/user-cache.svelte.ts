import type { TUsersData } from "$lib/types";
import { fetchUsers } from "$lib/api/users";
import { CacheEntry } from "./cache-entry.svelte";

export class UserCache {
  private entry = new CacheEntry<TUsersData[]>(async () => {
    const res = await fetchUsers({ limit: 100, includeDeleted: true });
    return res.data;
  });

  get data() {
    return this.entry.data;
  }
  get loading() {
    return this.entry.loading;
  }
  get error() {
    return this.entry.error;
  }

  fetch(force?: boolean) {
    return this.entry.fetch(force);
  }
  invalidate() {
    this.entry.invalidate();
  }
}
