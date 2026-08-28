import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";
import { appCache } from "$lib/cache";
import { getEffectiveElectionStatus } from "$lib/election-lifecycle-client";

export const load: PageLoad = async ({ fetch }) => {
  const votingState = await appCache
    .get("votingState", {})
    .fetchOrThrow(false, { fetch })
    .catch(() => null);

  // 1. If there is a lastClosed election, navigate to its results
  if (votingState?.lastClosed?.id) {
    redirect(302, `/elections/${votingState.lastClosed.id}/results`);
  }

  // 2. If there is an open election and the voter has already voted, navigate to its live results
  if (votingState?.open?.id && votingState.myVotes?.hasVoted) {
    redirect(302, `/elections/${votingState.open.id}/results`);
  }

  // 3. Look for the most recent closed/archived election from the elections list
  const elections = await appCache
    .get("elections", {})
    .fetchOrThrow(false, { fetch })
    .catch(() => []);

  const closedOrArchived = (elections ?? []).find((e) => {
    const status = getEffectiveElectionStatus(e);
    return status === "closed" || status === "archived";
  });

  if (closedOrArchived) {
    redirect(302, `/elections/${closedOrArchived.id}/results`);
  }

  // Fallback to elections index if no results are visible
  redirect(302, "/elections");
};
