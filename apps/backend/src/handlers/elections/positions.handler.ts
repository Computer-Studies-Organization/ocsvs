import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createPositionRoute,
  deletePositionRoute,
  listPositionsRoute,
  updatePositionRoute,
} from "@/routes/elections/positions.routes";
import { createDb } from "@/config/db";
import { positionRepo } from "@/database/repositories/position.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  positionLifecycleCoordinator,
  PositionLifecycleError,
} from "@/lib/position-lifecycle-coordinator";
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

  try {
    const row = await positionLifecycleCoordinator.create(
      db,
      { electionId: id, name: body.name, displayOrder: body.displayOrder },
      { id: actorAccountId, username: actorUsername },
    );
    return c.json(row, httpStatusCodes.CREATED);
  } catch (error) {
    if (error instanceof PositionLifecycleError) {
      if (error.status === 404) {
        return c.json({ message: error.message }, httpStatusCodes.NOT_FOUND);
      }
      return c.json({ message: error.message }, httpStatusCodes.CONFLICT);
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

  try {
    const updated = await positionLifecycleCoordinator.update(
      db,
      { electionId: id, positionId, name: body.name, displayOrder: body.displayOrder },
      { id: actorAccountId, username: actorUsername },
    );
    return c.json(updated, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof PositionLifecycleError) {
      if (error.status === 404) {
        return c.json({ message: error.message }, httpStatusCodes.NOT_FOUND);
      }
      return c.json({ message: error.message }, httpStatusCodes.CONFLICT);
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

  try {
    await positionLifecycleCoordinator.delete(
      db,
      { electionId: id, positionId },
      { id: actorAccountId, username: actorUsername },
    );
    return c.json({ message: ERROR_MESSAGES.POSITION_DELETED_SUCCESSFULLY }, httpStatusCodes.OK);
  } catch (error) {
    if (error instanceof PositionLifecycleError) {
      if (error.status === 404) {
        return c.json({ message: error.message }, httpStatusCodes.NOT_FOUND);
      }
      return c.json({ message: error.message }, httpStatusCodes.CONFLICT);
    }
    throw error;
  }
};
