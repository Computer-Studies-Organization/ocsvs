import type { TElection } from "$lib/types";

export interface TVotingState {
  selectedVotes: Record<string, string | null>;
  currentPositionIndex: number;
}

export interface TStepperPosition {
  id: string;
  name: string;
  displayOrder: number;
  candidates: Array<{ id: string; fullName: string }>;
}

export function buildPositionsFromElection(_election: TElection): TStepperPosition[] {
  return [];
}

export function createVotingState(positions: TStepperPosition[]): TVotingState {
  const selectedVotes: Record<string, string | null> = {};
  for (const pos of positions) {
    selectedVotes[pos.id] = null;
  }
  return { selectedVotes, currentPositionIndex: 0 };
}

export function selectCandidate(
  state: TVotingState,
  positionId: string,
  candidateId: string,
): TVotingState {
  return { ...state, selectedVotes: { ...state.selectedVotes, [positionId]: candidateId } };
}

export function goNext(state: TVotingState, totalPositions: number): TVotingState {
  if (totalPositions === 0) return state;
  return {
    ...state,
    currentPositionIndex: Math.min(state.currentPositionIndex + 1, totalPositions - 1),
  };
}

export function goPrevious(state: TVotingState): TVotingState {
  return { ...state, currentPositionIndex: Math.max(state.currentPositionIndex - 1, 0) };
}

export function isFirstPosition(state: TVotingState): boolean {
  return state.currentPositionIndex === 0;
}

export function isLastPosition(state: TVotingState, totalPositions: number): boolean {
  return state.currentPositionIndex === totalPositions - 1;
}

export function hasCurrentVote(state: TVotingState, positions: TStepperPosition[]): boolean {
  const current = positions[state.currentPositionIndex];
  if (!current) return false;
  return state.selectedVotes[current.id] !== null;
}

export function allPositionsVoted(state: TVotingState, positions: TStepperPosition[]): boolean {
  return positions.every((p) => state.selectedVotes[p.id] !== null);
}

export function getSelectedVotes(
  state: TVotingState,
): Array<{ positionId: string; candidateId: string }> {
  const out: Array<{ positionId: string; candidateId: string }> = [];
  for (const [positionId, candidateId] of Object.entries(state.selectedVotes)) {
    if (candidateId !== null) out.push({ positionId, candidateId });
  }
  return out;
}

export function getSelectedCount(state: TVotingState): number {
  return Object.values(state.selectedVotes).filter((id) => id !== null).length;
}
