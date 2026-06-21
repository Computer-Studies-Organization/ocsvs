import { createRoute, z } from "@hono/zod-openapi";
import {
  CreatePositionBodySchema,
  PositionSchema,
  UpdatePositionBodySchema,
} from "@/database/openapi-schemas";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import createErrorSchema from "@/middleware/utils/create-error-schema";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorResponse = z.object({ message: z.string() });
const IdParams = z.object({ id: z.string() });
const PositionIdParams = z.object({ id: z.string(), positionId: z.string() });
const MessageResponse = z.object({ message: z.string() });

export const listPositionsRoute = createRoute({
  method: "get",
  path: "/elections/{id}/positions",
  tags: ["Positions"],
  request: {
    params: IdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.array(PositionSchema),
      "List of positions for the election",
    ),
  },
});

export const createPositionRoute = createRoute({
  method: "post",
  path: "/elections/{id}/positions",
  tags: ["Positions"],
  request: {
    params: IdParams,
    body: jsonContent(CreatePositionBodySchema, "Position data"),
  },
  responses: {
    [httpStatusCodes.CREATED]: jsonContent(
      PositionSchema,
      ERROR_MESSAGES.POSITION_CREATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorResponse, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorResponse, ERROR_MESSAGES.ELECTION_NOT_FOUND),
    [httpStatusCodes.CONFLICT]: jsonContent(ErrorResponse, ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(CreatePositionBodySchema),
      "Validation failed",
    ),
  },
});

export const updatePositionRoute = createRoute({
  method: "patch",
  path: "/elections/{id}/positions/{positionId}",
  tags: ["Positions"],
  request: {
    params: PositionIdParams,
    body: jsonContent(UpdatePositionBodySchema, "Fields to update"),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(PositionSchema, ERROR_MESSAGES.POSITION_UPDATED_SUCCESSFULLY),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorResponse, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorResponse, ERROR_MESSAGES.POSITION_NOT_FOUND),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(UpdatePositionBodySchema),
      "Validation failed",
    ),
  },
});

export const deletePositionRoute = createRoute({
  method: "delete",
  path: "/elections/{id}/positions/{positionId}",
  tags: ["Positions"],
  request: {
    params: PositionIdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      MessageResponse,
      ERROR_MESSAGES.POSITION_DELETED_SUCCESSFULLY,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorResponse, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorResponse, ERROR_MESSAGES.POSITION_NOT_FOUND),
    [httpStatusCodes.CONFLICT]: jsonContent(ErrorResponse, ERROR_MESSAGES.POSITION_HAS_CANDIDATES),
  },
});
