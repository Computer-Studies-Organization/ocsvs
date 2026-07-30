import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createCandidateRoute,
  deleteCandidateRoute,
  getCandidateRoute,
  listCandidatesRoute,
  updateCandidateRoute,
} from "@/routes/candidates/routes";
import { createDb } from "@/config/db";
import { candidateStore } from "@/database/repositories/candidate-store";
import {
  candidateLifecycleCoordinator,
  CandidateLifecycleError,
} from "@/lib/candidate-lifecycle-coordinator";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const createCandidate: AppRouteHandler<typeof createCandidateRoute> = async (c) => {
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { fullName, accountId, positionId, partyId, manifesto } = c.req.valid("json");
  const { db } = createDb(c);
  const urlCtx = { env: c.env, requestUrl: c.req.url };

  try {
    const candidate = await candidateLifecycleCoordinator.create(
      db,
      { fullName, accountId, positionId, partyId, manifesto },
      { id: actorAccountId, username: actorUsername },
      urlCtx,
    );

    return c.json(
      {
        message: ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY,
        candidate,
      },
      httpStatusCodes.OK,
    );
  } catch (error: unknown) {
    if (error instanceof CandidateLifecycleError) {
      return c.json({ message: error.message }, error.status as any);
    }
    throw error;
  }
};

export const listCandidates: AppRouteHandler<typeof listCandidatesRoute> = async (c) => {
  const { page, limit, includeInactive, includeDeleted, positionId } = c.req.valid("query");
  const shouldIncludeInactive = includeInactive || includeDeleted;

  if (
    shouldIncludeInactive &&
    c.var.authUser.role !== "admin" &&
    c.var.authUser.role !== "super_admin"
  ) {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const { db } = createDb(c);
  const urlCtx = { env: c.env, requestUrl: c.req.url };

  const result = await candidateStore.listForAdminTable(
    db,
    {
      page,
      limit,
      includeInactive: shouldIncludeInactive,
      positionId,
    },
    urlCtx,
  );

  return c.json(
    {
      data: result.data,
      meta: result.meta,
    },
    httpStatusCodes.OK,
  );
};

export const getCandidate: AppRouteHandler<typeof getCandidateRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const urlCtx = { env: c.env, requestUrl: c.req.url };

  const isAdmin = c.var.authUser?.role === "admin" || c.var.authUser?.role === "super_admin";
  const candidate = await candidateStore.findById(db, id, { includeInactive: isAdmin }, urlCtx);

  if (!candidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  return c.json(candidate, httpStatusCodes.OK);
};

export const updateCandidate: AppRouteHandler<typeof updateCandidateRoute> = async (c) => {
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const updateData = c.req.valid("json");
  const { db } = createDb(c);
  const urlCtx = { env: c.env, requestUrl: c.req.url };

  try {
    const updatedCandidate = await candidateLifecycleCoordinator.update(
      db,
      id,
      updateData,
      { id: actorAccountId, username: actorUsername },
      urlCtx,
    );

    return c.json(
      {
        message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
        candidate: updatedCandidate,
      },
      httpStatusCodes.OK,
    );
  } catch (error: unknown) {
    if (error instanceof CandidateLifecycleError) {
      return c.json({ message: error.message }, error.status as any);
    }
    throw error;
  }
};

export const deleteCandidate: AppRouteHandler<typeof deleteCandidateRoute> = async (c) => {
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);

  try {
    await candidateLifecycleCoordinator.deactivate(db, id, {
      id: actorAccountId,
      username: actorUsername,
    });

    return c.json({ message: ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY }, httpStatusCodes.OK);
  } catch (error: unknown) {
    if (error instanceof CandidateLifecycleError) {
      return c.json({ message: error.message }, error.status as any);
    }
    throw error;
  }
};
