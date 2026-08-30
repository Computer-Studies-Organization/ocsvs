import type { PageLoad } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { ApiError } from "$lib/api/client";
import { appCache } from "$lib/cache";

export const load: PageLoad = async ({ params, fetch }) => {
  const { electionId, partyId } = params;

  const partyLists = await appCache
    .get("partyLists", { electionId })
    .fetchOrThrow(false, { fetch })
    .catch((cause: unknown) => {
      if (cause instanceof ApiError) {
        if (cause.status === 401) redirect(302, "/auth");
        if (cause.status === 404) error(404, "Election not found");
      }
      throw cause;
    });

  const party = partyLists.find((p) => p.id === partyId);
  if (!party) error(404, "Party not found");

  const [candidates, positions] = await Promise.all([
    appCache
      .get("candidates", { electionId, includeInactive: false })
      .fetchOrThrow(false, { fetch }),
    appCache.get("positions", { electionId }).fetchOrThrow(false, { fetch }),
  ]).catch((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      redirect(302, "/auth");
    }
    throw cause;
  });

  const positionMap = new Map(positions.map((p) => [p.id, p]));
  const partyCandidates = candidates
    .filter((c) => c.partyId === partyId)
    .sort((a, b) => {
      const orderA = positionMap.get(a.positionId)?.displayOrder ?? 999;
      const orderB = positionMap.get(b.positionId)?.displayOrder ?? 999;
      return orderA - orderB;
    });

  return {
    party,
    electionId,
    candidates: partyCandidates,
    positions,
  };
};
