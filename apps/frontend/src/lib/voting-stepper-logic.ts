import type { TVotingPageState } from "./voting-page-state";

export interface TStepperVotingState {
  selectedVotes: Record<string, string | null>;
  currentPositionIndex: number;
}

export interface TStepperPosition {
  id: string;
  name: string;
  displayOrder: number;
  candidates: Array<{
    id: string;
    fullName: string;
    imageUrl: string | null;
    manifesto: string;
    partyId?: string | null;
  }>;
}

export function createVotingState(positions: TStepperPosition[]): TStepperVotingState {
  const selectedVotes: Record<string, string | null> = {};
  for (const pos of positions) {
    selectedVotes[pos.id] = null;
  }
  return { selectedVotes, currentPositionIndex: 0 };
}

export function selectCandidate(
  state: TStepperVotingState,
  positionId: string,
  candidateId: string,
): TStepperVotingState {
  return { ...state, selectedVotes: { ...state.selectedVotes, [positionId]: candidateId } };
}

export function clearSelection(
  state: TStepperVotingState,
  positionId: string,
): TStepperVotingState {
  return { ...state, selectedVotes: { ...state.selectedVotes, [positionId]: null } };
}

export function selectPartySlate(
  state: TStepperVotingState,
  positions: TStepperPosition[],
  partyId: string,
): TStepperVotingState {
  const nextSelected = { ...state.selectedVotes };
  for (const pos of positions) {
    const partyCandidate = pos.candidates.find((c) => c.partyId === partyId);
    nextSelected[pos.id] = partyCandidate?.id ?? null;
  }
  return { ...state, selectedVotes: nextSelected };
}

export function goNext(state: TStepperVotingState, totalPositions: number): TStepperVotingState {
  if (totalPositions === 0) return state;
  return {
    ...state,
    currentPositionIndex: Math.min(state.currentPositionIndex + 1, totalPositions),
  };
}

export function goPrevious(state: TStepperVotingState): TStepperVotingState {
  return { ...state, currentPositionIndex: Math.max(state.currentPositionIndex - 1, 0) };
}

export function isFirstPosition(state: TStepperVotingState): boolean {
  return state.currentPositionIndex === 0;
}

export function isLastPosition(state: TStepperVotingState, totalPositions: number): boolean {
  return state.currentPositionIndex === totalPositions - 1;
}

export function isReviewStep(state: TStepperVotingState, totalPositions: number): boolean {
  return state.currentPositionIndex === totalPositions;
}

export function hasCurrentVote(state: TStepperVotingState, positions: TStepperPosition[]): boolean {
  const current = positions[state.currentPositionIndex];
  if (!current) return false;
  return state.selectedVotes[current.id] !== null;
}

export function allPositionsVoted(
  state: TStepperVotingState,
  positions: TStepperPosition[],
): boolean {
  return positions.every((p) => state.selectedVotes[p.id] !== null);
}

export function getSelectedVotes(
  state: TStepperVotingState,
): Array<{ positionId: string; candidateId: string }> {
  const out: Array<{ positionId: string; candidateId: string }> = [];
  for (const [positionId, candidateId] of Object.entries(state.selectedVotes)) {
    if (candidateId !== null) out.push({ positionId, candidateId });
  }
  return out;
}

export function getSelectedCount(state: TStepperVotingState): number {
  return Object.values(state.selectedVotes).filter((id) => id !== null).length;
}

export function withVoting(page: TVotingPageState, voting: TStepperVotingState): TVotingPageState {
  if (page.kind !== "stepper") return page;
  return { ...page, voting };
}
