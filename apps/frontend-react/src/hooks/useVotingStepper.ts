import { useCallback, useMemo, useState } from "react";
import {
  createVotingState,
  selectCandidate as selectCandidateLogic,
  goNext as goNextLogic,
  goPrevious as goPreviousLogic,
  isFirstPosition as isFirstPositionFn,
  isLastPosition as isLastPositionFn,
  hasCurrentVote as hasCurrentVoteFn,
  allPositionsVoted as allPositionsVotedFn,
  getSelectedCandidateIds as getSelectedCandidateIdsFn,
  getSelectedCount as getSelectedCountFn,
  type TVotingState,
  type TPositionGroup,
} from "./voting-stepper-logic";

export type { TPositionGroup };

export function useVotingStepper(positionGroups: TPositionGroup[]) {
  const [state, setState] = useState<TVotingState>(() => createVotingState(positionGroups));

  const selectCandidate = useCallback((positionId: string, candidateId: string) => {
    setState((prev) => selectCandidateLogic(prev, positionId, candidateId));
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => goNextLogic(prev, positionGroups.length));
  }, [positionGroups.length]);

  const goPrevious = useCallback(() => {
    setState((prev) => goPreviousLogic(prev));
  }, []);

  const getSelectedCandidateIds = useCallback(() => {
    return getSelectedCandidateIdsFn(state);
  }, [state]);

  return useMemo(
    () => ({
      currentPositionIndex: state.currentPositionIndex,
      selectedVotes: state.selectedVotes,
      currentGroup: positionGroups[state.currentPositionIndex],
      isFirstPosition: isFirstPositionFn(state),
      isLastPosition: isLastPositionFn(state, positionGroups.length),
      hasCurrentVote: hasCurrentVoteFn(state, positionGroups),
      allPositionsVoted: allPositionsVotedFn(state, positionGroups),
      selectedCount: getSelectedCountFn(state),
      selectCandidate,
      goNext,
      goPrevious,
      getSelectedCandidateIds,
    }),
    [state, positionGroups.length, selectCandidate, goNext, goPrevious, getSelectedCandidateIds],
  );
}
