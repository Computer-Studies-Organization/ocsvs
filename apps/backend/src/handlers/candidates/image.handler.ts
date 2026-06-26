import type { AppRouteHandler } from "@/lib/types/app-types";
import type { deleteImageRoute, uploadImageRoute } from "@/routes/candidates/routes";
import { createDb } from "@/config/db";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { B2Client } from "@/lib/b2-client";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import * as httpStatusCodes from "@/openapi/http-status-codes";

function getB2Client(c: any): B2Client {
  return new B2Client({
    applicationKeyId: c.env.B2_APPLICATION_KEY_ID,
    applicationKey: c.env.B2_APPLICATION_KEY,
    bucketName: c.env.B2_BUCKET_NAME,
  });
}

export const uploadImage: AppRouteHandler<typeof uploadImageRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const b2 = getB2Client(c);

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

  // Upload to B2
  const buffer = Buffer.from(await file.arrayBuffer());
  const { url } = await b2.uploadImage(id, buffer, file.type, file.name);

  // Update database
  await candidateRepo.updateImageUrl(db, id, url);

  // Write audit log
  await auditLogRepo.insert(db, {
    action: "candidate.update",
    targetType: "candidate",
    targetId: id,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  // Return updated candidate
  const updatedCandidate = await candidateRepo.getForAdminView(db, id);

  return c.json(
    {
      message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
      candidate: updatedCandidate,
    },
    httpStatusCodes.OK,
  );
};

export const deleteImage: AppRouteHandler<typeof deleteImageRoute> = async (c) => {
  if (c.var.authUser.role !== "admin") {
    return c.json({ message: ERROR_MESSAGES.FORBIDDEN }, httpStatusCodes.FORBIDDEN);
  }
  const actorAccountId = c.var.authUser.id;
  const actorUsername = c.var.authUser.username;

  const { id } = c.req.valid("param");
  const { db } = createDb(c);
  const b2 = getB2Client(c);

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
  await auditLogRepo.insert(db, {
    action: "candidate.update",
    targetType: "candidate",
    targetId: id,
    actorAccountIdSnapshot: actorAccountId,
    actorUsernameSnapshot: actorUsername,
  });

  // Return updated candidate
  const updatedCandidate = await candidateRepo.getForAdminView(db, id);

  return c.json(
    {
      message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
      candidate: updatedCandidate,
    },
    httpStatusCodes.OK,
  );
};
