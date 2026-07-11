import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  deleteImageRoute,
  getCandidateImageRoute,
  uploadImageRoute,
} from "@/routes/candidates/routes";
import { createDb } from "@/config/db";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { getImageStorage, resolveCandidateImageUrl } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  candidateLifecycleCoordinator,
  CandidateLifecycleError,
} from "@/lib/candidate-lifecycle-coordinator";
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

  // Get file from form data
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch (err) {
    c.var.logger?.warn(
      { err, candidateId: id },
      "Failed to parse multipart form data on candidate image upload",
    );
    return c.json({ message: ERROR_MESSAGES.INVALID_REQUEST }, httpStatusCodes.BAD_REQUEST);
  }
  const file = formData.get("image") as File | null;

  if (!file) {
    return c.json({ message: ERROR_MESSAGES.NO_IMAGE_PROVIDED }, httpStatusCodes.BAD_REQUEST);
  }

  try {
    const updatedCandidate = await candidateLifecycleCoordinator.uploadAvatar(
      db,
      id,
      file,
      storage,
      { id: actorAccountId, username: actorUsername },
      c.var.logger,
    );

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

export const deleteImage: AppRouteHandler<typeof deleteImageRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const storage = getImageStorage(c.env);

  try {
    const updatedCandidate = await candidateLifecycleCoordinator.deleteAvatar(
      db,
      id,
      storage,
      { id: actorAccountId, username: actorUsername },
      c.var.logger,
    );

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
