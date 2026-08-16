import type { AppRouteHandler } from "@/lib/types/app-types";
import type {
  deleteImageRoute,
  getCandidateImageRoute,
  uploadImageRoute,
} from "@/routes/candidates/routes";
import { createDb } from "@/config/db";
import {
  candidateLifecycleCoordinator,
  CandidateLifecycleError,
} from "@/lib/candidate-lifecycle-coordinator";
import { getImageStorage } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { isAdminRole } from "@/lib/election-visibility";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const uploadImage: AppRouteHandler<typeof uploadImageRoute> = async (c) => {
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const storage = getImageStorage(c.env);
  const urlCtx = { env: c.env, requestUrl: c.req.url };

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
      urlCtx,
      c.var.logger,
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

export const deleteImage: AppRouteHandler<typeof deleteImageRoute> = async (c) => {
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const storage = getImageStorage(c.env);
  const urlCtx = { env: c.env, requestUrl: c.req.url };

  try {
    const updatedCandidate = await candidateLifecycleCoordinator.deleteAvatar(
      db,
      id,
      storage,
      { id: actorAccountId, username: actorUsername },
      urlCtx,
      c.var.logger,
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

export const getCandidateImage: AppRouteHandler<typeof getCandidateImageRoute> = async (c) => {
  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const storage = getImageStorage(c.env);

  const isAdmin = isAdminRole(c.var.authUser.role);
  const voterVisibleAt = Math.floor(Date.now() / 1000);

  try {
    const image = await candidateLifecycleCoordinator.downloadAvatar(
      db,
      id,
      storage,
      { includeInactive: isAdmin, ...(isAdmin ? {} : { voterVisibleAt }) },
      c.req.header("If-None-Match"),
    );
    if (image.notModified) {
      return new Response(null, {
        status: httpStatusCodes.NOT_MODIFIED,
        headers: {
          ETag: image.etag,
          "Cache-Control": "private, no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return c.body(image.data, httpStatusCodes.OK, {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-cache",
      ETag: image.etag,
      "X-Content-Type-Options": "nosniff",
    });
  } catch (error: unknown) {
    if (error instanceof CandidateLifecycleError) {
      return c.json({ message: error.message }, error.status as any);
    }
    c.var.logger?.error({ err: error, candidateId: id }, "Failed to download candidate image");
    return c.json(
      { message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR },
      httpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
