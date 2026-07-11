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

// ponytail: local to this handler file. If a PositionLifecycleCoordinator is
// ever extracted (mirroring CandidateLifecycleCoordinator), move this there.
class PositionLifecycleError extends Error {
  readonly code: "ELECTION_NOT_IN_DRAFT" | "POSITION_HAS_CANDIDATES";
  readonly status: 409;
  constructor(code: PositionLifecycleError["code"]) {
    super(ERROR_MESSAGES[code]);
    this.code = code;
    this.status = 409;
    this.name = "PositionLifecycleError";
  }
}

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
  try {
    const row = await db.transaction(async (tx) => {
      // Re-verify draft status inside the transaction to close the TOCTOU
      // window: the election could have been transitioned out of draft between
      // the pre-check above and this write.
      const current = await electionRepo.findById(tx, id);
      if (!current || current.status !== "draft") {
        throw new PositionLifecycleError("ELECTION_NOT_IN_DRAFT");
      }
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
    if (error instanceof PositionLifecycleError) {
      return c.json({ message: error.message }, error.status);
    }
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
  if (!election) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  try {
    const updated = await db.transaction(async (tx) => {
      // Re-verify draft status inside the transaction to close the TOCTOU
      // window: the election could have been transitioned out of draft between
      // the pre-check above and this write.
      const current = await electionRepo.findById(tx, id);
      if (!current || current.status !== "draft") {
        throw new PositionLifecycleError("ELECTION_NOT_IN_DRAFT");
      }
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
    if (error instanceof PositionLifecycleError) {
      return c.json({ message: error.message }, error.status);
    }
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
  if (!election) {
    return c.json({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }
  try {
    await db.transaction(async (tx) => {
      // Re-verify draft status and candidate count inside the transaction to
      // close the TOCTOU window: the election could have been transitioned out
      // of draft, or candidates added, between the pre-checks above and this
      // write.
      const current = await electionRepo.findById(tx, id);
      if (!current || current.status !== "draft") {
        throw new PositionLifecycleError("ELECTION_NOT_IN_DRAFT");
      }
      const candCount = await candidateRepo.countByPositionId(tx, positionId, {
        includeInactive: true,
      });
      if (candCount > 0) {
        throw new PositionLifecycleError("POSITION_HAS_CANDIDATES");
      }
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
  } catch (error) {
    if (error instanceof PositionLifecycleError) {
      return c.json({ message: error.message }, error.status);
    }
    throw error;
  }
};
