export { CacheEntry } from "./cache-entry.svelte";
export { UserCache } from "./user-cache.svelte";
export { ElectionCache } from "./election-cache.svelte";
export { PositionCache } from "./position-cache.svelte";
export { CandidateCache } from "./candidate-cache.svelte";
export { ResultCache } from "./result-cache.svelte";

import { UserCache } from "./user-cache.svelte";
import { ElectionCache } from "./election-cache.svelte";
import { PositionCache } from "./position-cache.svelte";
import { CandidateCache } from "./candidate-cache.svelte";
import { ResultCache } from "./result-cache.svelte";

export const userCache = new UserCache();
export const electionCache = new ElectionCache();
export const positionCache = new PositionCache();
export const candidateCache = new CandidateCache();
export const resultCache = new ResultCache();
