import { createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { SelectCandidateSchema } from "@/database/openapi-schemas";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { MAX_SIZE } from "@/lib/b2-client";
import { booleanQuery } from "@/lib/validation/boolean-query";
import { requireAdmin } from "@/middleware/auth";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const MAX_IMAGE_REQUEST_BYTES = MAX_SIZE + 1024 * 1024;

export const createCandidateSchema = z.object({
  fullName: z.string(),
  accountId: z.string(),
  positionId: z.string(),
  partyId: z.string().nullable().optional(),
  manifesto: z.string(),
});

export const updateCandidateSchema = z
  .object({
    fullName: z.string().optional(),
    partyId: z.string().nullable().optional(),
    manifesto: z.string().optional(),
  })
  .strict();

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export const ListCandidatesQuerySchema = PaginationSchema.extend({
  includeInactive: booleanQuery.default("false"),
  includeDeleted: booleanQuery.default("false"),
  positionId: z.string().optional(),
  electionId: z.string().optional(),
});

export const createCandidateRoute = createRoute({
  tags: ["Candidates"],
  method: "post",
  path: "/candidates",
  security: [{ sessionAuth: [] }],
  request: {
    body: jsonContent(createCandidateSchema, "Candidate details"),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        candidate: SelectCandidateSchema,
      }),
      ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INVALID_REQUEST,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_ALREADY_EXISTS,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.PARTY_LIST_NOT_FOUND,
    ),
    [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    ),
  },
});

export const listCandidatesRoute = createRoute({
  tags: ["Candidates"],
  method: "get",
  path: "/candidates",
  security: [{ sessionAuth: [] }],
  request: {
    query: ListCandidatesQuerySchema,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        data: z.array(SelectCandidateSchema),
        meta: z.object({
          total: z.number().int(),
          page: z.number().int(),
          limit: z.number().int(),
          totalPages: z.number().int(),
        }),
      }),
      "List of candidates",
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.ELECTION_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
  },
});

export const getCandidateRoute = createRoute({
  tags: ["Candidates"],
  method: "get",
  path: "/candidates/{id}",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(SelectCandidateSchema, "Candidate details"),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
  },
});

export const updateCandidateRoute = createRoute({
  tags: ["Candidates"],
  method: "put",
  path: "/candidates/{id}",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: jsonContent(updateCandidateSchema, "Updated candidate details"),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        candidate: SelectCandidateSchema,
      }),
      ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INVALID_REQUEST,
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT,
    ),
  },
});

export const deleteCandidateRoute = createRoute({
  tags: ["Candidates"],
  method: "delete",
  path: "/candidates/{id}",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT,
    ),
  },
});

export const uploadImageRoute = createRoute({
  tags: ["Candidates"],
  method: "post",
  path: "/candidates/{id}/image",
  security: [{ sessionAuth: [] }],
  middleware: [
    requireAdmin,
    bodyLimit({
      maxSize: MAX_IMAGE_REQUEST_BYTES,
      onError: (c) =>
        c.json({ message: ERROR_MESSAGES.PAYLOAD_TOO_LARGE }, httpStatusCodes.PAYLOAD_TOO_LARGE),
    }),
  ],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        candidate: SelectCandidateSchema,
      }),
      ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.PAYLOAD_TOO_LARGE]: jsonContent(
      z.object({ message: z.string() }),
      ERROR_MESSAGES.PAYLOAD_TOO_LARGE,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.NO_IMAGE_PROVIDED,
    ),
    [httpStatusCodes.UNSUPPORTED_MEDIA_TYPE]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNSUPPORTED_MEDIA_TYPE,
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT,
    ),
  },
});

export const deleteImageRoute = createRoute({
  tags: ["Candidates"],
  method: "delete",
  path: "/candidates/{id}/image",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        candidate: SelectCandidateSchema,
      }),
      ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.FORBIDDEN,
    ),
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT,
    ),
  },
});

export const getCandidateImageRoute = createRoute({
  tags: ["Candidates"],
  method: "get",
  path: "/candidates/{id}/image",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: {
      description: "Candidate image file",
      content: {
        "image/*": {
          schema: {
            type: "string",
            format: "binary",
          },
        },
      },
    },
    [httpStatusCodes.NOT_MODIFIED]: {
      description: "Candidate image has not changed",
    },
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
    [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    ),
  },
});
