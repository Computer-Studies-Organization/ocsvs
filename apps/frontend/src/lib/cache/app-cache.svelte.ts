import type {
  TElection,
  TElectionStatus,
  TResults,
  TVotingState,
  TPosition,
  TCandidate,
  TUsersData,
} from "$lib/types";
import { CacheEntry } from "./cache-entry.svelte";
import type { ApiClientAdapter } from "./api-client";

export interface AppCacheMap {
  elections: {
    params: { status?: TElectionStatus };
    data: TElection[];
  };
  election: {
    params: { id: string };
    data: TElection;
  };
  votingState: {
    params: Record<string, never>;
    data: TVotingState;
  };
  positions: {
    params: { electionId: string };
    data: TPosition[];
  };
  candidates: {
    params: { electionId: string; positionId?: string; includeInactive?: boolean };
    data: TCandidate[];
  };
  results: {
    params: { electionId: string };
    data: TResults;
  };
  users: {
    params: { limit?: number; includeDeleted?: boolean };
    data: TUsersData[];
  };
}

export type ResourceName = keyof AppCacheMap;
export type ResourceParams<K extends ResourceName> = AppCacheMap[K]["params"];
export type ResourceData<K extends ResourceName> = AppCacheMap[K]["data"];

export interface InvalidationFilter<K extends ResourceName = ResourceName> {
  resource?: K;
  params?: Partial<ResourceParams<K>>;
}

export function serializeParams(params: Record<string, any>): string {
  if (!params) return "";
  const sortedKeys = Object.keys(params).sort();
  const obj: Record<string, any> = {};
  for (const k of sortedKeys) {
    obj[k] = params[k];
  }
  return JSON.stringify(obj);
}

interface RegistryEntry<T> {
  resource: ResourceName;
  params: any;
  entry: CacheEntry<T>;
}

const fetchers: {
  [K in ResourceName]: (
    api: ApiClientAdapter,
    params: ResourceParams<K>,
  ) => Promise<ResourceData<K>>;
} = {
  elections: (api, params) => api.listElections(params.status),
  election: (api, params) => api.getElection(params.id),
  votingState: (api) => api.getVotingState(),
  positions: (api, params) => api.listPositions(params.electionId),
  candidates: (api, params) => api.allCandidates(params).then((res) => res.data),
  results: (api, params) => api.listResults(params.electionId),
  users: (api, params) => api.fetchUsers(params).then((res) => res.data),
};

export class AppCache {
  private api: ApiClientAdapter;
  private registry = new Map<string, RegistryEntry<any>>();

  constructor(api: ApiClientAdapter) {
    this.api = api;
  }

  get<K extends ResourceName>(resource: K, params: ResourceParams<K>): CacheEntry<ResourceData<K>> {
    const paramKey = serializeParams(params);
    const key = `${resource}:${paramKey}`;
    let reg = this.registry.get(key);
    if (!reg) {
      const fetcher = () => fetchers[resource](this.api, params);
      const entry = new CacheEntry(fetcher);
      reg = { resource, params, entry };
      this.registry.set(key, reg);
    }
    return reg.entry;
  }

  invalidate<K extends ResourceName>(filter?: InvalidationFilter<K>): void {
    if (!filter) {
      for (const reg of this.registry.values()) {
        reg.entry.invalidate();
      }
      this.registry.clear();
      return;
    }

    const { resource, params } = filter;

    for (const [key, reg] of this.registry.entries()) {
      let match = true;

      if (resource && reg.resource !== resource) {
        match = false;
      }

      if (match && params) {
        for (const k of Object.keys(params)) {
          if (reg.params[k] !== (params as any)[k]) {
            match = false;
            break;
          }
        }
      }

      if (match) {
        reg.entry.invalidate();
        this.registry.delete(key);
      }
    }
  }
}
