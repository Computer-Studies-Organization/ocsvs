import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createCandidateRoute,
  deleteCandidateRoute,
  getCandidateRoute,
  listCandidatesRoute,
  updateCandidateRoute,
} from "@/routes/candidates/routes";
import { createDb } from "@/config/db";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { resolveCandidateImageUrl } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  candidateLifecycleCoordinator,
  CandidateLifecycleError,
} from "@/lib/candidate-lifecycle-coordinator";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const createCandidate: AppRouteHandler<typeof createCandidateRoute> = async (c) => {
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { fullName, accountId, positionId, manifesto } = c.req.valid("json");
  const { db } = createDb(c);

  try {
    const candidate = await candidateLifecycleCoordinator.create(
      db,
      { fullName, accountId, positionId, manifesto },
      { id: actorAccountId, username: actorUsername },
    );

    return c.json(
      {
        message: ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY,
        candidate,
      },
      httpStatusCodes.OK,
    );
  } catch (error) {
    if (error instanceof CandidateLifecycleError) {
      return c.json({ message: error.message }, error.status as any);
    }
    throw error;
  }
};

export const listCandidates: AppRouteHandler<typeof listCandidatesRoute> = async (c) => {
  const { page, limit, includeDeleted, positionId } = c.req.valid("query");

  if (includeDeleted && c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const { db } = createDb(c);

  const result = await candidateRepo.listForAdminTable(db, {
    page,
    limit,
    includeInactive: includeDeleted,
    positionId,
  });

  const mappedData = result.data.map((cand) => ({
    ...cand,
    imageUrl: resolveCandidateImageUrl(cand.imageUrl, cand.id, c.env, c.req.url),
  }));

  return c.json(
    {
      data: mappedData,
      meta: result.meta,
    },
    httpStatusCodes.OK,
  );
};

export const getCandidate: AppRouteHandler<typeof getCandidateRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const { db } = createDb(c);

  const candidate = await candidateRepo.getForAdminView(db, id);

  if (!candidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  candidate.imageUrl = resolveCandidateImageUrl(candidate.imageUrl, candidate.id, c.env, c.req.url);

  return c.json(candidate, httpStatusCodes.OK);
};

export const updateCandidate: AppRouteHandler<typeof updateCandidateRoute> = async (c) => {
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const updateData = c.req.valid("json");
  const { db } = createDb(c);

  try {
    const updatedCandidate = await candidateLifecycleCoordinator.update(db, id, updateData, {
      id: actorAccountId,
      username: actorUsername,
    });

    updatedCandidate.imageUrl = resolveCandidateImageUrl(
      updatedCandidate.imageUrl,
      updatedCandidate.id,
      c.env,
      c.req.url,
    );

    return c.json(
      {
        message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
        candidate: updatedCandidate,
      },
      httpStatusCodes.OK,
    );
  } catch (error) {
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
  } catch (error) {
    if (error instanceof CandidateLifecycleError) {
      return c.json({ message: error.message }, error.status as any);
    }
    throw error;
  }
};
