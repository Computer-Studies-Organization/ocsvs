import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { electionCache, positionCache, candidateCache } from "$lib/cache";

export const load: PageLoad = async ({ params, depends }) => {
  depends("app:position");
  const { electionId, positionId } = params;

  const [election, allPos, candidates] = await Promise.all([
    electionCache.fetch(electionId),
    positionCache.fetch(electionId),
    candidateCache.fetch(electionId, positionId, false, true),
  ]);

  if (!election) error(404, "Election not found");

  const position = allPos?.find((p) => p.id === positionId) ?? null;
  const mappedCandidates = (candidates ?? []).map((c) => ({
    id: c.id,
    fullName: c.fullName,
    isActive: (c as { isActive?: number }).isActive,
  }));

  return { election, position, candidates: mappedCandidates };
};
