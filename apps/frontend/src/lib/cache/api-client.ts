import type {
  TElection,
  TElectionStatus,
  TResults,
  TVotingState,
  TPosition,
  TCandidate,
  TUsersData,
} from "$lib/types";

export interface ApiClientAdapter {
  listElections(status?: TElectionStatus): Promise<TElection[]>;
  getElection(id: string): Promise<TElection>;
  getVotingState(): Promise<TVotingState>;
  listPositions(electionId: string): Promise<TPosition[]>;
  allCandidates(query: {
    electionId: string;
    positionId?: string;
    includeInactive?: boolean;
  }): Promise<{ data: TCandidate[] }>;
  listResults(electionId: string): Promise<TResults>;
  fetchUsers(query?: { limit?: number; includeDeleted?: boolean }): Promise<{ data: TUsersData[] }>;
}
