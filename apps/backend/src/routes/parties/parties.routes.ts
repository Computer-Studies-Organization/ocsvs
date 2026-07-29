import { createRoute, z } from "@hono/zod-openapi";
import {
  CreatePartyListBodySchema,
  PartyListSchema,
  UpdatePartyListBodySchema,
} from "@/database/openapi-schemas";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import createErrorSchema from "@/middleware/utils/create-error-schema";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorResponse = z.object({ message: z.string() });
const IdParams = z.object({ id: z.string() });
const PartyIdParams = z.object({ id: z.string(), partyId: z.string() });
const MessageResponse = z.object({ message: z.string() });
const PartyConflictDescription =
  "Party list conflict: duplicate name or code, or election is not in draft";

export const listPartyListsRoute = createRoute({
  method: "get",
  path: "/elections/{id}/parties",
  tags: ["Party Lists"],
  security: [{ sessionAuth: [] }],
  request: {
    params: IdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.array(PartyListSchema),
      "List of party lists for the election",
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorResponse, ERROR_MESSAGES.ELECTION_NOT_FOUND),
  },
});

export const createPartyListRoute = createRoute({
  method: "post",
  path: "/elections/{id}/parties",
  tags: ["Party Lists"],
  security: [{ sessionAuth: [] }],
  request: {
    params: IdParams,
    body: jsonContent(CreatePartyListBodySchema, "Party list data"),
  },
  responses: {
    [httpStatusCodes.CREATED]: jsonContent(
      PartyListSchema,
      ERROR_MESSAGES.PARTY_LIST_CREATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorResponse, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorResponse, ERROR_MESSAGES.ELECTION_NOT_FOUND),
    [httpStatusCodes.CONFLICT]: jsonContent(ErrorResponse, PartyConflictDescription),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(CreatePartyListBodySchema),
      "Validation failed",
    ),
  },
});

export const updatePartyListRoute = createRoute({
  method: "patch",
  path: "/elections/{id}/parties/{partyId}",
  tags: ["Party Lists"],
  security: [{ sessionAuth: [] }],
  request: {
    params: PartyIdParams,
    body: jsonContent(UpdatePartyListBodySchema, "Fields to update"),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      PartyListSchema,
      ERROR_MESSAGES.PARTY_LIST_UPDATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorResponse, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorResponse, ERROR_MESSAGES.PARTY_LIST_NOT_FOUND),
    [httpStatusCodes.CONFLICT]: jsonContent(ErrorResponse, PartyConflictDescription),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(UpdatePartyListBodySchema),
      "Validation failed",
    ),
  },
});

export const deletePartyListRoute = createRoute({
  method: "delete",
  path: "/elections/{id}/parties/{partyId}",
  tags: ["Party Lists"],
  security: [{ sessionAuth: [] }],
  request: {
    params: PartyIdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      MessageResponse,
      ERROR_MESSAGES.PARTY_LIST_DELETED_SUCCESSFULLY,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorResponse, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorResponse, ERROR_MESSAGES.PARTY_LIST_NOT_FOUND),
    [httpStatusCodes.CONFLICT]: jsonContent(ErrorResponse, ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT),
  },
});
