import type { DbClient } from "@/database/repositories/database.type";
import { electionRepo, type ElectionRow } from "@/database/repositories/election.repository";
import { getEffectiveElectionStatus } from "@/lib/election-lifecycle";
import type { UserRole } from "@/lib/user-lifecycle-coordinator";

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "super_admin";
}

export async function findVisibleElection(
  db: DbClient,
  electionId: string,
  role: UserRole,
): Promise<ElectionRow | null> {
  const election = await electionRepo.findById(db, electionId);

  if (!election || (!isAdminRole(role) && getEffectiveElectionStatus(election) === "draft")) {
    return null;
  }

  return election;
}
