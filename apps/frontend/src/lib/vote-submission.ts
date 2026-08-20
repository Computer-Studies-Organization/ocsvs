import type { TVotingState } from "./types";
import { hasVotedIn } from "./voting-page-state";

export async function submitVoteWithReconciliation(
  electionId: string,
  submit: () => Promise<unknown>,
  refreshVotingState: () => Promise<TVotingState | null>,
): Promise<void> {
  try {
    await submit();
  } catch (error) {
    const state = await refreshVotingState();
    if (!state || !hasVotedIn(state, electionId)) throw error;
    return;
  }

  await refreshVotingState();
}
