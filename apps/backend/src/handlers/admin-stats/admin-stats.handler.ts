import type { AppRouteHandler } from "@/lib/types/app-types";
import type { getAdminStatsRoute } from "@/routes/admin-stats/routes";
import { createDb } from "@/config/db";
import { accounts, elections, ballotSnapshots, auditLog } from "@/database/schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import type { AuditAction, TargetType } from "@/lib/constants/audit-actions";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const getAdminStats: AppRouteHandler<typeof getAdminStatsRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const { db } = createDb(c);

  // 1. Count active voters (role = 'user' and not deleted)
  const voterCountResult = await db
    .select({ count: count() })
    .from(accounts)
    .where(and(eq(accounts.role, "user"), isNull(accounts.deletedAt)))
    .get();
  const votersCount = voterCountResult?.count ?? 0;

  // 2. Count total elections
  const electionCountResult = await db.select({ count: count() }).from(elections).get();
  const electionsCount = electionCountResult?.count ?? 0;

  // 3. Get active election and turnout details
  const openElection = await db.select().from(elections).where(eq(elections.status, "open")).get();

  let activeElection = null;
  if (openElection) {
    // Turnout is count of ballot submissions recorded at vote time.
    // Using ballot_snapshots (one row per submitted ballot) instead of
    // count(distinct votes.userId) so that anonymised votes from hard-deleted
    // users are still counted accurately.
    const turnoutResult = await db
      .select({ count: count() })
      .from(ballotSnapshots)
      .where(eq(ballotSnapshots.electionId, openElection.id))
      .get();

    const votedCount = turnoutResult?.count ?? 0;
    const turnoutPct = votersCount > 0 ? Math.round((votedCount / votersCount) * 10000) / 100 : 0;

    activeElection = {
      id: openElection.id,
      name: openElection.name,
      opensAt: openElection.opensAt,
      closesAt: openElection.closesAt,
      votedCount,
      votersCount,
      turnoutPct,
    };
  }

  // 4. Get last 5 audit logs
  const logs = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(5)
    .all();

  return c.json(
    {
      votersCount,
      electionsCount,
      activeElection,
      recentLogs: logs.map((l) => ({
        ...l,
        action: l.action as AuditAction,
        targetType: l.targetType as TargetType,
      })),
    },
    httpStatusCodes.OK,
  );
};
