import type { PageLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { getCandidate } from "$lib/api/candidates";
import { fetchUser } from "$lib/api/users";
import { electionCache, positionCache } from "$lib/cache";

export const load: PageLoad = async ({ params, depends }) => {
  depends("app:candidate");
  const { electionId, positionId, candidateId } = params;

  const cand = (await getCandidate(candidateId)) as unknown as {
    id: string;
    fullName: string;
    accountId: string;
    positionId: string;
    manifesto: string;
    isActive: number;
    imageUrl: string | null;
  };

  const [election, positions, user] = await Promise.all([
    electionCache.fetch(electionId),
    positionCache.fetch(electionId),
    fetchUser(cand.accountId).catch(() => null),
  ]);

  if (!election) error(404, "Election not found");

  const position = positions?.find((p) => p.id === positionId) ?? null;

  return { candidate: cand, election, position, user };
};
