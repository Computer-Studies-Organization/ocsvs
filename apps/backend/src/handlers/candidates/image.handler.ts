import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  deleteImageRoute,
  getCandidateImageRoute,
  uploadImageRoute,
} from "@/routes/candidates/routes";
import { createDb } from "@/config/db";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { getImageStorage, ImageValidationError, resolveCandidateImageUrl } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const uploadImage: AppRouteHandler<typeof uploadImageRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const storage = getImageStorage(c.env);

  // Check candidate exists
  const candidate = await candidateRepo.getForAdminView(db, id);
  if (!candidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  // Get file from form data
  const formData = await c.req.formData();
  const file = formData.get("image") as File | null;

  if (!file) {
    return c.json({ message: ERROR_MESSAGES.NO_IMAGE_PROVIDED }, httpStatusCodes.BAD_REQUEST);
  }

  try {
    const { url } = await storage.upload(id, file);

    // Update database
    await candidateRepo.updateImageUrl(db, id, url);

    // Delete old image if exists
    if (candidate.imageUrl) {
      try {
        await storage.delete(candidate.imageUrl);
      } catch (error) {
        // Log but continue - old image cleanup is best-effort
        console.warn("Failed to delete old B2 image:", error);
      }
    }

    // Write audit log
    try {
      await auditLogRepo.insert(db, {
        action: "candidate.update",
        targetType: "candidate",
        targetId: id,
        actorAccountIdSnapshot: actorAccountId,
        actorUsernameSnapshot: actorUsername,
      });
    } catch (auditErr) {
      c.var.logger?.error(
        { auditErr, action: "candidate.update", targetId: id },
        "audit insert failed",
      );
    }

    // Return updated candidate
    const updatedCandidate = await candidateRepo.getForAdminView(db, id);
    if (updatedCandidate) {
      updatedCandidate.imageUrl = resolveCandidateImageUrl(
        updatedCandidate.imageUrl,
        updatedCandidate.id,
        c.env,
        c.req.url,
      );
    }

    return c.json(
      {
        message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
        candidate: updatedCandidate,
      },
      httpStatusCodes.OK,
    );
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return c.json({ message: error.message }, httpStatusCodes.UNSUPPORTED_MEDIA_TYPE);
    }
    throw error;
  }
};

export const deleteImage: AppRouteHandler<typeof deleteImageRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const storage = getImageStorage(c.env);

  // Check candidate exists
  const candidate = await candidateRepo.getForAdminView(db, id);
  if (!candidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  // Delete from storage if image exists
  if (candidate.imageUrl) {
    try {
      await storage.delete(candidate.imageUrl);
    } catch (error) {
      // Log but continue - we still want to clear the DB reference
      console.warn("Failed to delete B2 image:", error);
    }
  }

  // Clear imageUrl in database
  await candidateRepo.updateImageUrl(db, id, null);

  // Write audit log
  try {
    await auditLogRepo.insert(db, {
      action: "candidate.update",
      targetType: "candidate",
      targetId: id,
      actorAccountIdSnapshot: actorAccountId,
      actorUsernameSnapshot: actorUsername,
    });
  } catch (auditErr) {
    c.var.logger?.error(
      { auditErr, action: "candidate.update", targetId: id },
      "audit insert failed",
    );
  }

  // Return updated candidate
  const updatedCandidate = await candidateRepo.getForAdminView(db, id);
  if (updatedCandidate) {
    updatedCandidate.imageUrl = resolveCandidateImageUrl(
      updatedCandidate.imageUrl,
      updatedCandidate.id,
      c.env,
      c.req.url,
    );
  }

  return c.json(
    {
      message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
      candidate: updatedCandidate,
    },
    httpStatusCodes.OK,
  );
};

export const getCandidateImage: AppRouteHandler<typeof getCandidateImageRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const storage = getImageStorage(c.env);

  const candidate = await candidateRepo.getForAdminView(db, id);
  if (!candidate || !candidate.imageUrl) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  try {
    const { data, contentType } = await storage.download(candidate.imageUrl);
    return c.body(data, httpStatusCodes.OK, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    });
  } catch (error) {
    console.error("Failed to download image:", error);
    return c.json({ message: "Failed to download image" }, httpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
