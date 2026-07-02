import { listElections, getElection, getVotingState, listResults } from "$lib/api/elections";
import { listPositions } from "$lib/api/positions";
import { allCandidates } from "$lib/api/candidates";
import { fetchUsers } from "$lib/api/users";
import { AppCache } from "./app-cache.svelte";
import type { ApiClientAdapter } from "./api-client";

// Build the production adapter
const productionApi: ApiClientAdapter = {
  listElections,
  getElection,
  getVotingState,
  listPositions,
  allCandidates,
  listResults,
  fetchUsers,
};

export { CacheEntry } from "./cache-entry.svelte";
export { AppCache } from "./app-cache.svelte";
export type { ApiClientAdapter } from "./api-client";

// Export the singleton configured for production
export const appCache = new AppCache(productionApi);
