import type { TElectionStatus } from "@/database/schema";
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
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { assertTransition, TransitionError } from "@/lib/election-lifecycle";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const listElectionsHandler: AppRouteHandler<typeof listElectionsRoute> = async (c) => {
  const { db } = createDb(c);
  const { status } = c.req.valid("query");
  return c.json(
    await electionRepo.list(db, status ? { status: status as TElectionStatus } : undefined),
    httpStatusCodes.OK,
  );
};

export const createElectionHandler: AppRouteHandler<typeof createElectionRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const body = c.req.valid("json");
  const id = await electionRepo.create(db, body);
  const row = await electionRepo.findById(db, id);
  if (!row) {
    throw new Error("Election row missing immediately after create");
  }
  return c.json(row, httpStatusCodes.CREATED);
};

export const getCurrentElectionHandler: AppRouteHandler<typeof getCurrentElectionRoute> = async (
  c,
) => {
  const { db } = createDb(c);
  const row = await electionQueries.getCurrentElection(db);
  if (!row) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
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
  if (c.var.authUser?.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const existing = await electionRepo.findById(db, id);
  if (!existing) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  if (existing.status !== "draft" && existing.status !== "closed") {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT }, httpStatusCodes.CONFLICT);
  }
  await electionRepo.updateMetadata(db, id, body);
  const updated = await electionRepo.findById(db, id);
  if (!updated) {
    throw new Error("Election row missing immediately after update");
  }
  return c.json(updated, httpStatusCodes.OK);
};

export const transitionElectionHandler: AppRouteHandler<typeof transitionElectionRoute> = async (
  c,
) => {
  if (c.var.authUser?.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  const { to, opensAt, closesAt } = c.req.valid("json");
  const existing = await electionRepo.findById(db, id);
  if (!existing) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  try {
    const positionCount = await electionQueries.countPositions(db, id);
    assertTransition(existing.status as TElectionStatus, to, { opensAt, closesAt }, positionCount);
  } catch (err) {
    if (err instanceof TransitionError) {
      return c.json({ message: err.message }, err.status);
    }
    throw err;
  }
  await electionRepo.updateStatus(db, id, {
    status: to,
    opensAt: opensAt ?? null,
    closesAt: closesAt ?? null,
  });
  const messageKey = (
    existing.status === "draft" && to === "open"
      ? "ELECTION_OPENED_SUCCESSFULLY"
      : to === "closed"
        ? "ELECTION_CLOSED_SUCCESSFULLY"
        : to === "archived"
          ? "ELECTION_ARCHIVED_SUCCESSFULLY"
          : "ELECTION_REOPENED_SUCCESSFULLY"
  ) as keyof typeof ERROR_MESSAGES;
  return c.json({ message: ERROR_MESSAGES[messageKey] }, httpStatusCodes.OK);
};
