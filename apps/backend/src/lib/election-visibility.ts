import type { DbClient } from "@/database/repositories/database.type";
import { electionRepo, type ElectionRow } from "@/database/repositories/election.repository";
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

  if (!election || (election.status === "draft" && !isAdminRole(role))) {
    return null;
  }

  return election;
}
