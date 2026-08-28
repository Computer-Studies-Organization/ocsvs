import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { listPartyLists } from "$lib/api/parties";

export const load: PageLoad = async ({ params, fetch }) => {
  const { electionId, partyId } = params;

  const parties = await listPartyLists(electionId, { fetch }).catch((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 404) error(404, "Election not found");
    throw cause;
  });

  const party = parties.find((p) => p.id === partyId);
  if (!party) error(404, "Party not found");

  return { party, electionId };
};
