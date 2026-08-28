import type { AppRouteHandler } from "@/lib/types/app-types";
import type { getAdminStatsRoute } from "@/routes/admin-stats/routes";
import { createDb } from "@/config/db";
import { accounts, elections, auditLog } from "@/database/schema";
import { electionQueries } from "@/database/queries/election.queries";
import { electionRepo } from "@/database/repositories/election.repository";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import type { AuditAction, TargetType } from "@/lib/constants/audit-actions";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const getAdminStats: AppRouteHandler<typeof getAdminStatsRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const { db } = createDb(c);

  // Execute independent queries concurrently to minimize DB round-trips
  const [voterCountResult, electionCountResult, openElection, logs] = await Promise.all([
    db
      .select({ count: count() })
      .from(accounts)
      .where(and(eq(accounts.role, "user"), isNull(accounts.deletedAt)))
      .get(),
    db.select({ count: count() }).from(elections).get(),
    electionRepo.findCurrentlyOpen(db),
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(5).all(),
  ]);

  const votersCount = voterCountResult?.count ?? 0;
  const electionsCount = electionCountResult?.count ?? 0;

  let activeElection = null;
  if (openElection) {
    const turnout = await electionQueries.getTurnout(db, openElection.id);

    activeElection = {
      id: openElection.id,
      name: openElection.name,
      opensAt: openElection.opensAt,
      closesAt: openElection.closesAt,
      votedCount: turnout.totalBallotsCast,
      votersCount: turnout.totalEligibleVoters,
      turnoutPct: turnout.turnoutPercentage,
    };
  }

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
