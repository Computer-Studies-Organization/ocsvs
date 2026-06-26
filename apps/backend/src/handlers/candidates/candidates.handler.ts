import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  createCandidateRoute,
  deleteCandidateRoute,
  getCandidateRoute,
  listCandidatesRoute,
  updateCandidateRoute,
} from "@/routes/candidates/routes";
import { eq } from "drizzle-orm";
import { createDb } from "@/config/db";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { accounts } from "@/database/schema";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const createCandidate: AppRouteHandler<typeof createCandidateRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { fullName, accountId, positionId, manifesto } = c.req.valid("json");
  const { db } = createDb(c);

  // Verify account exists
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).get();

  if (!account) {
    return c.json({ message: ERROR_MESSAGES.ACCOUNT_NOT_FOUND }, httpStatusCodes.BAD_REQUEST);
  }

  // Ensure no active candidate for same account+position
  const exists = await candidateRepo.existsActiveForAccountPosition(db, accountId, positionId);
  if (exists) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
  }

  const candidateId = await candidateRepo.create(db, {
    fullName,
    accountId,
    positionId,
    manifesto,
  });

  await auditLogRepo.insert(db, {
    action: "candidate.create",
    targetType: "candidate",
    targetId: candidateId,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  return c.json(
    {
      message: ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY,
      candidate: {
        id: candidateId,
        fullName,
        accountId,
        positionId,
        manifesto,
      },
    },
    httpStatusCodes.OK,
  );
};

export const listCandidates: AppRouteHandler<typeof listCandidatesRoute> = async (c) => {
  const { page, limit, includeDeleted, positionId } = c.req.valid("query");

  if (includeDeleted && c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }

  const { db } = createDb(c);

  const result = await candidateRepo.listForAdminTable(db, {
    page,
    limit,
    includeInactive: includeDeleted,
    positionId,
  });

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

  const candidate = await candidateRepo.getForAdminView(db, id);

  if (!candidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  return c.json(candidate, httpStatusCodes.OK);
};

export const updateCandidate: AppRouteHandler<typeof updateCandidateRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const updateData = c.req.valid("json");
  const { db } = createDb(c);

  const existingCandidate = await candidateRepo.getForAdminView(db, id);
  if (!existingCandidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  await candidateRepo.update(db, id, updateData);

  await auditLogRepo.insert(db, {
    action: "candidate.update",
    targetType: "candidate",
    targetId: id,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  const updatedCandidate = await candidateRepo.getForAdminView(db, id);

  return c.json(
    {
      message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
      candidate: updatedCandidate,
    },
    httpStatusCodes.OK,
  );
};

export const deleteCandidate: AppRouteHandler<typeof deleteCandidateRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);

  const existingCandidate = await candidateRepo.getForAdminView(db, id);
  if (!existingCandidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  await candidateRepo.softDelete(db, id);

  await auditLogRepo.insert(db, {
    action: "candidate.deactivate",
    targetType: "candidate",
    targetId: id,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  return c.json({ message: ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY }, httpStatusCodes.OK);
};
