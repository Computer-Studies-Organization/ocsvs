import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createPositionRoute,
  deletePositionRoute,
  listPositionsRoute,
  updatePositionRoute,
} from "@/routes/elections/positions.routes";
import { createDb } from "@/config/db";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { isUniqueConstraintError } from "@/lib/errors";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const listPositionsHandler: AppRouteHandler<typeof listPositionsRoute> = async (c) => {
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  return c.json(await positionRepo.listByElection(db, id), httpStatusCodes.OK);
};

export const createPositionHandler: AppRouteHandler<typeof createPositionRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const election = await electionRepo.findById(db, id);
  if (!election) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  if (election.status !== "draft") {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT }, httpStatusCodes.CONFLICT);
  }
  try {
    const row = await db.transaction(async (tx) => {
      const newId = await positionRepo.create(tx, {
        electionId: id,
        name: body.name,
        displayOrder: body.displayOrder,
      });
      const createdRow = await positionRepo.findById(tx, newId);
      if (!createdRow) {
        throw new Error("Position row missing immediately after create");
      }
      await auditLogRepo.insert(tx, {
        action: "position.create",
        targetType: "position",
        targetId: newId,
        actorAccountIdSnapshot: actorAccountId,
        actorUsernameSnapshot: actorUsername,
      });
      return createdRow;
    });

    return c.json(row, httpStatusCodes.CREATED);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ message: ERROR_MESSAGES.POSITION_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
    }
    throw error;
  }
};

export const updatePositionHandler: AppRouteHandler<typeof updatePositionRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { id, positionId } = c.req.valid("param");
  const body = c.req.valid("json");
  const existing = await positionRepo.findById(db, positionId);
  if (!existing || existing.electionId !== id) {
    return c.json({ message: ERROR_MESSAGES.POSITION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  const election = await electionRepo.findById(db, id);
  if (!election || election.status !== "draft") {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT }, httpStatusCodes.CONFLICT);
  }
  try {
    const updated = await db.transaction(async (tx) => {
      await positionRepo.update(tx, positionId, body);
      const updatedRow = await positionRepo.findById(tx, positionId);
      if (!updatedRow) {
        throw new Error("Position row missing immediately after update");
      }
      await auditLogRepo.insert(tx, {
        action: "position.update",
        targetType: "position",
        targetId: positionId,
        actorAccountIdSnapshot: actorAccountId,
        actorUsernameSnapshot: actorUsername,
      });
      return updatedRow;
    });

    return c.json(updated, httpStatusCodes.OK);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ message: ERROR_MESSAGES.POSITION_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
    }
    throw error;
  }
};

export const deletePositionHandler: AppRouteHandler<typeof deletePositionRoute> = async (c) => {
  if (c.var.authUser?.role !== "admin" && c.var.authUser?.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;
  const { db } = createDb(c);
  const { id, positionId } = c.req.valid("param");
  const existing = await positionRepo.findById(db, positionId);
  if (!existing || existing.electionId !== id) {
    return c.json({ message: ERROR_MESSAGES.POSITION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  const election = await electionRepo.findById(db, id);
  if (!election || election.status !== "draft") {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT }, httpStatusCodes.CONFLICT);
  }
  const candCount = await candidateRepo.countByPositionId(db, positionId, {
    includeInactive: true,
  });
  if (candCount > 0) {
    return c.json({ message: ERROR_MESSAGES.POSITION_HAS_CANDIDATES }, httpStatusCodes.CONFLICT);
  }
  await db.transaction(async (tx) => {
    await positionRepo.delete(tx, positionId);
    await auditLogRepo.insert(tx, {
      action: "position.delete",
      targetType: "position",
      targetId: positionId,
      actorAccountIdSnapshot: actorAccountId,
      actorUsernameSnapshot: actorUsername,
    });
  });

  return c.json({ message: ERROR_MESSAGES.POSITION_DELETED_SUCCESSFULLY }, httpStatusCodes.OK);
};
