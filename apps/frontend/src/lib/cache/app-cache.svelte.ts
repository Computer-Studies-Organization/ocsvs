import type {
  TElection,
  TElectionStatus,
  TResults,
  TVotingState,
  TPosition,
  TCandidate,
  TPartyList,
} from "$lib/types";
import { CacheEntry } from "./cache-entry.svelte";
import type { ApiClientAdapter } from "./api-client";
import type { UsersResponse } from "$lib/api/users";

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
  partyLists: {
    params: { electionId: string };
    data: TPartyList[];
  };
  users: {
    params: {
      page?: number;
      limit?: number;
      search?: string;
      yearLevel?: string;
      course?: string;
      role?: string;
      includeDeleted?: boolean;
    };
    data: UsersResponse;
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
    options?: { fetch?: typeof fetch },
  ) => Promise<ResourceData<K>>;
} = {
  elections: (api, params, opts) => api.listElections(params.status, opts),
  election: (api, params, opts) => api.getElection(params.id, opts),
  votingState: (api, params, opts) => api.getVotingState(opts),
  positions: (api, params, opts) => api.listPositions(params.electionId, opts),
  candidates: (api, params, opts) => api.allCandidates(params, opts).then((res) => res.data),
  results: (api, params, opts) => api.listResults(params.electionId, opts),
  partyLists: (api, params, opts) => api.listPartyLists(params.electionId, opts),
  users: (api, params, opts) => api.fetchUsers(params, opts),
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
      const fetcher = (opts?: { fetch?: typeof fetch }) =>
        fetchers[resource](this.api, params, opts);
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
