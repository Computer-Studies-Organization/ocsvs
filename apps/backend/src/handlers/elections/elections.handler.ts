import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createElectionRoute,
  getCurrentElectionRoute,
  getElectionRoute,
  listElectionsRoute,
  transitionElectionRoute,
  updateElectionRoute,
} from "@/routes/elections/routes";

import { createDb } from "@/config/db";
import { electionQueries } from "@/database/queries/election.queries";
import { electionRepo } from "@/database/repositories/election.repository";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { resolveCandidateImageUrl } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { TransitionError } from "@/lib/election-lifecycle";
import { ElectionLifecycleCoordinator } from "@/lib/election-lifecycle-coordinator";
import type { TElectionStatus } from "@/database/schema";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const createElectionHandler: AppRouteHandler<typeof createElectionRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const body = c.req.valid("json");

  const id = await ElectionLifecycleCoordinator.create(db, body, {
    id: actorAccountId,
    username: actorUsername,
  });

  const row = await electionRepo.findById(db, id);
  if (!row) {
    throw new Error("Election row missing immediately after create");
  }

  return c.json(row, httpStatusCodes.CREATED);
};

export const listElectionsHandler: AppRouteHandler<typeof listElectionsRoute> = async (c) => {
  const { db } = createDb(c);
  const { status } = c.req.valid("query");
  return c.json(
    await electionRepo.list(db, status ? { status: status as TElectionStatus } : undefined),
    httpStatusCodes.OK,
  );
};

export const getCurrentElectionHandler: AppRouteHandler<typeof getCurrentElectionRoute> = async (
  c,
) => {
  const { db } = createDb(c);
  const row = await electionQueries.getCurrentElection(db);
  if (!row) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  if (row.positions) {
    for (const p of row.positions) {
      if (p.candidates) {
        for (const cand of p.candidates) {
          cand.imageUrl = resolveCandidateImageUrl(cand.imageUrl, cand.id, c.env, c.req.url);
        }
      }
    }
  }
  return c.json(row, httpStatusCodes.OK);
};

export const getElectionHandler: AppRouteHandler<typeof getElectionRoute> = async (c) => {
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  const row = await electionRepo.findById(db, id);
  if (!row) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  return c.json(row, httpStatusCodes.OK);
};

export const updateElectionHandler: AppRouteHandler<typeof updateElectionRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const existing = await electionRepo.findById(db, id);
  if (!existing) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  if (existing.status !== "draft") {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT }, httpStatusCodes.CONFLICT);
  }
  await electionRepo.updateMetadata(db, id, body);
  const updated = await electionRepo.findById(db, id);
  if (!updated) {
    throw new Error("Election row missing immediately after update");
  }
  await auditLogRepo.insert(db, {
    action: "election.update",
    targetType: "election",
    targetId: id,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  return c.json(updated, httpStatusCodes.OK);
};

export const transitionElectionHandler: AppRouteHandler<typeof transitionElectionRoute> = async (
  c,
) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  const { to, opensAt, closesAt } = c.req.valid("json");

  try {
    const result = await ElectionLifecycleCoordinator.transition(db, id, {
      to: to as TElectionStatus,
      opensAt,
      closesAt,
      actor: { id: actorAccountId, username: actorUsername },
    });
    return c.json({ message: ERROR_MESSAGES[result.messageKey] }, httpStatusCodes.OK);
  } catch (err) {
    if (err instanceof TransitionError) {
      return c.json({ message: err.message }, err.status);
    }
    throw err;
  }
};
