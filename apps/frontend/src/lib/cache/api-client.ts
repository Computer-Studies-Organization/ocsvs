import type {
  TElection,
  TElectionStatus,
  TResults,
  TVotingState,
  TPosition,
  TCandidate,
  TUsersData,
} from "$lib/types";
import type { ApiFetchOptions } from "$lib/api/client";

export interface ApiClientAdapter {
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
    query?: { limit?: number; includeDeleted?: boolean },
    options?: ApiFetchOptions,
  ): Promise<{ data: TUsersData[] }>;
}
