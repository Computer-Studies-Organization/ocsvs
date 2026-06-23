import type { TVotingState } from "./types";

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
