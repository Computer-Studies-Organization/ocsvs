import type {
  TElection,
  TElectionStatus,
  TResults,
  TVotingState,
  TPosition,
  TCandidate,
  TPartyList,
} from "$lib/types";
import type { ApiFetchOptions } from "$lib/api/client";
import type { UsersResponse } from "$lib/api/users";

export interface ApiClientAdapter {
  listPartyLists(electionId: string, options?: ApiFetchOptions): Promise<TPartyList[]>;
  listElections(status?: TElectionStatus, options?: ApiFetchOptions): Promise<TElection[]>;
  getElection(id: string, options?: ApiFetchOptions): Promise<TElection>;
  getVotingState(options?: ApiFetchOptions): Promise<TVotingState>;
  listPositions(electionId: string, options?: ApiFetchOptions): Promise<TPosition[]>;
  allCandidates(
    query: {
      electionId: string;
      positionId?: string;
      includeInactive?: boolean;
    },
    options?: ApiFetchOptions,
  ): Promise<{ data: TCandidate[] }>;
  listResults(electionId: string, options?: ApiFetchOptions): Promise<TResults>;
  fetchUsers(
    query?: {
      page?: number;
      limit?: number;
      search?: string;
      yearLevel?: string;
      course?: string;
      role?: string;
      includeDeleted?: boolean;
    },
    options?: ApiFetchOptions,
  ): Promise<UsersResponse>;
}
