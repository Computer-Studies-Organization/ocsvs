import type { TElection, TPosition, TVotingCandidate, TVotingState } from "./types";
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
  return state.myVotes.hasVoted;
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
  | { kind: "admin"; election: TElection }
  | {
      kind: "stepper";
      election: TElection;
      positions: TStepperPosition[];
      voting: TStepperVotingState;
    };

export interface TVotingPageInput {
  apiState: TVotingState | null;
  positions: TPosition[] | null;
  candidates: TVotingCandidate[] | null;
  loadError: string | null;
  isAdmin: boolean;
}

export function buildStepperPositions(
  positions: TPosition[] | null,
  candidates: TVotingCandidate[] | null,
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
        .map((c) => ({
          id: c.id,
          fullName: c.fullName,
          imageUrl: c.imageUrl,
          manifesto: c.manifesto,
          partyId: c.partyId ?? null,
        })),
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
  if (input.isAdmin) {
    return { kind: "admin", election: input.apiState.open };
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

/**
 * Preserves the user's in-progress selections (voting state) when transitioning
 * to a new page state for the exact same election. This prevents auto-refresh
 * from wiping out selected candidates before the user submits their ballot.
 *
 * If the page state transitions to a non-stepper kind (e.g. election closed) or
 * if the candidate/position set changes structurally, the selections are discarded.
 */
function arePositionsStructurallyEqual(a: TStepperPosition[], b: TStepperPosition[]): boolean {
  if (a.length !== b.length) return false;
  const mapA = new Map(
    a.map((p) => [
      p.id,
      p.candidates
        .map((c) => c.id)
        .sort()
        .join(","),
    ]),
  );
  const mapB = new Map(
    b.map((p) => [
      p.id,
      p.candidates
        .map((c) => c.id)
        .sort()
        .join(","),
    ]),
  );
  if (mapA.size !== mapB.size) return false;
  for (const [posId, candStrA] of mapA) {
    const candStrB = mapB.get(posId);
    if (candStrB === undefined || candStrA !== candStrB) {
      return false;
    }
  }
  return true;
}

export function preserveVotingState(
  next: TVotingPageState,
  current: TVotingPageState,
): TVotingPageState {
  if (
    next.kind === "stepper" &&
    current.kind === "stepper" &&
    next.election.id === current.election.id &&
    arePositionsStructurallyEqual(current.positions, next.positions)
  ) {
    const currentPositionIndex = Math.min(
      current.voting.currentPositionIndex,
      next.positions.length,
    );
    return {
      ...next,
      voting: {
        selectedVotes: { ...current.voting.selectedVotes },
        currentPositionIndex,
      },
    };
  }
  return next;
}
