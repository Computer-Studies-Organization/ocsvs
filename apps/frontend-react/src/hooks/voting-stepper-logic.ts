export interface TVotingState {
  selectedVotes: Record<string, string | null>
  currentPositionIndex: number
}

export interface TPositionGroup {
  id: string
  title: string
  description: string
  candidates: Array<{ id: string; [key: string]: unknown }>
}

export function createVotingState(positionGroups: TPositionGroup[]): TVotingState {
  const selectedVotes: Record<string, string | null> = {}
  for (const group of positionGroups) {
    selectedVotes[group.id] = null
  }
  return { selectedVotes, currentPositionIndex: 0 }
}

export function selectCandidate(state: TVotingState, positionId: string, candidateId: string): TVotingState {
  return { ...state, selectedVotes: { ...state.selectedVotes, [positionId]: candidateId } }
}

export function goNext(state: TVotingState, totalPositions: number): TVotingState {
  if (totalPositions === 0) return state
  return { ...state, currentPositionIndex: Math.min(state.currentPositionIndex + 1, totalPositions - 1) }
}

export function goPrevious(state: TVotingState): TVotingState {
  return { ...state, currentPositionIndex: Math.max(state.currentPositionIndex - 1, 0) }
}

export function isFirstPosition(state: TVotingState): boolean {
  return state.currentPositionIndex === 0
}

export function isLastPosition(state: TVotingState, totalPositions: number): boolean {
  return state.currentPositionIndex === totalPositions - 1
}

export function hasCurrentVote(state: TVotingState, positionGroups: TPositionGroup[]): boolean {
  const currentGroup = positionGroups[state.currentPositionIndex]
  if (!currentGroup) return false
  return state.selectedVotes[currentGroup.id] !== null
}

export function allPositionsVoted(state: TVotingState, positionGroups: TPositionGroup[]): boolean {
  return positionGroups.every(group => state.selectedVotes[group.id] !== null)
}

export function getSelectedCandidateIds(state: TVotingState): string[] {
  return Object.values(state.selectedVotes).filter((id): id is string => id !== null)
}

export function getSelectedCount(state: TVotingState): number {
  return Object.values(state.selectedVotes).filter(id => id !== null).length
}
