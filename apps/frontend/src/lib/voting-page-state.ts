import type { TCandidate, TElection, TPosition, TVotingState } from "./types";
import type { TStepperPosition, TStepperVotingState } from "./voting-stepper-logic";
import { createVotingState } from "./voting-stepper-logic";

export type TEmptyCardVariant = "next-draft" | "last-closed" | "both" | "none";

export function pickEmptyCardVariant(state: TVotingState): TEmptyCardVariant {
  const hasNext = state.nextDraft !== null;
  const hasClosed = state.lastClosed !== null;
  if (hasNext && hasClosed) return "both";
  if (hasNext) return "next-draft";
  if (hasClosed) return "last-closed";
  return "none";
}

export function hasVotedIn(state: TVotingState, electionId: string | null | undefined): boolean {
  if (!electionId) return false;
  if (state.myVotes.electionId !== electionId) return false;
  return state.myVotes.votes.length > 0;
}

export type TVotingPageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "empty";
      variant: TEmptyCardVariant;
      nextDraft: TVotingState["nextDraft"];
      lastClosed: TVotingState["lastClosed"];
      isAdmin: boolean;
    }
  | { kind: "voted"; election: TElection }
  | {
      kind: "stepper";
      election: TElection;
      positions: TStepperPosition[];
      voting: TStepperVotingState;
    };

export interface TVotingPageInput {
  apiState: TVotingState | null;
  positions: TPosition[] | null;
  candidates: TCandidate[] | null;
  loadError: string | null;
  isAdmin: boolean;
}

export function buildStepperPositions(
  positions: TPosition[] | null,
  candidates: TCandidate[] | null,
): TStepperPosition[] {
  if (!positions || !candidates) return [];
  return positions
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((p) => ({
      id: p.id,
      name: p.name,
      displayOrder: p.displayOrder,
      candidates: candidates
        .filter((c) => c.positionId === p.id)
        .map((c) => ({ id: c.id, fullName: c.fullName, imageUrl: c.imageUrl })),
    }))
    .filter((p) => p.candidates.length > 0);
}

export function deriveVotingPageState(input: TVotingPageInput): TVotingPageState {
  if (input.loadError !== null) {
    return { kind: "error", message: input.loadError };
  }
  if (input.apiState === null) {
    return { kind: "loading" };
  }
  if (input.apiState.open === null) {
    return {
      kind: "empty",
      variant: pickEmptyCardVariant(input.apiState),
      nextDraft: input.apiState.nextDraft,
      lastClosed: input.apiState.lastClosed,
      isAdmin: input.isAdmin,
    };
  }
  if (hasVotedIn(input.apiState, input.apiState.open.id)) {
    return { kind: "voted", election: input.apiState.open };
  }
  const positions = buildStepperPositions(input.positions, input.candidates);
  return {
    kind: "stepper",
    election: input.apiState.open,
    positions,
    voting: createVotingState(positions),
  };
}
