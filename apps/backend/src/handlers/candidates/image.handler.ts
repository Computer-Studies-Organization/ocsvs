import type { AppBindings, AppRouteHandler } from "@/lib/types/app-types";
import type {
  deleteImageRoute,
  getCandidateImageRoute,
  uploadImageRoute,
} from "@/routes/candidates/routes";
import { createDb } from "@/config/db";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { B2Client, resolveCandidateImageUrl } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

function getB2Client(env: AppBindings["Bindings"]): B2Client {
  if (!env.B2_APPLICATION_KEY_ID || !env.B2_APPLICATION_KEY) {
    throw new Error("B2 credentials are not configured");
  }
  return new B2Client({
    applicationKeyId: env.B2_APPLICATION_KEY_ID,
    applicationKey: env.B2_APPLICATION_KEY,
    bucketName: env.B2_BUCKET_NAME,
    publicBaseUrl: env.B2_PUBLIC_BASE_URL,
  });
}

export const uploadImage: AppRouteHandler<typeof uploadImageRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const b2 = getB2Client(c.env);

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

  // Validate file
  const validation = b2.validateFile({
    size: file.size,
    type: file.type,
  });

  if (!validation.valid) {
    return c.json(
      { message: validation.error || ERROR_MESSAGES.UNSUPPORTED_MEDIA_TYPE },
      httpStatusCodes.UNSUPPORTED_MEDIA_TYPE,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate file content matches declared MIME type
  const magicCheck = b2.validateMagicBytes(buffer, file.type);
  if (!magicCheck.valid) {
    // Log the specific validation error internally, but keep the API response generic for security
    c.var.logger?.warn(
      { error: magicCheck.error, fileType: file.type, candidateId: id, actorAccountId },
      "Image upload blocked: magic bytes mismatch",
    );
    return c.json(
      { message: ERROR_MESSAGES.UNSUPPORTED_MEDIA_TYPE },
      httpStatusCodes.UNSUPPORTED_MEDIA_TYPE,
    );
  }

  // Delete old image if exists
  if (candidate.imageUrl) {
    try {
      const oldKey = new URL(candidate.imageUrl).pathname.split("/").slice(3).join("/");
      await b2.deleteImage(oldKey);
    } catch (error) {
      // Log but continue - old image cleanup is best-effort
      console.warn("Failed to delete old B2 image:", error);
    }
  }

  const { url } = await b2.uploadImage(id, buffer, file.type, file.name);

  // Update database
  await candidateRepo.updateImageUrl(db, id, url);

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

export const deleteImage: AppRouteHandler<typeof deleteImageRoute> = async (c) => {
  if (c.var.authUser.role !== "admin" && c.var.authUser.role !== "super_admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const b2 = getB2Client(c.env);

  // Check candidate exists
  const candidate = await candidateRepo.getForAdminView(db, id);
  if (!candidate) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  // Delete from B2 if image exists
  if (candidate.imageUrl) {
    try {
      const key = new URL(candidate.imageUrl).pathname.split("/").slice(3).join("/");
      await b2.deleteImage(key);
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
  const b2 = getB2Client(c.env);

  const candidate = await candidateRepo.getForAdminView(db, id);
  if (!candidate || !candidate.imageUrl) {
    return c.json({ message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND }, httpStatusCodes.NOT_FOUND);
  }

  try {
    const bucketPrefix = `${c.env.B2_PUBLIC_BASE_URL}/${c.env.B2_BUCKET_NAME}/`;
    if (!candidate.imageUrl.startsWith(bucketPrefix)) {
      return c.json({ message: "Invalid image URL format" }, httpStatusCodes.BAD_REQUEST);
    }
    const key = candidate.imageUrl.substring(bucketPrefix.length);
    const { data, contentType } = await b2.downloadImage(key);
    return c.body(data, httpStatusCodes.OK, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    });
  } catch (error) {
    console.error("Failed to download image from B2:", error);
    return c.json({ message: "Failed to download image" }, httpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
