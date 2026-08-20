import { createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import jsonContent, { jsonContentRequired } from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const MAX_IDENTIFIER_LENGTH = 128;
export const MAX_BALLOT_SELECTIONS = 100;
export const MAX_VOTE_BODY_BYTES = 64 * 1024;

const boundedIdentifier = () => z.string().min(1).max(MAX_IDENTIFIER_LENGTH);

export const VoteItemSchema = z.object({
  candidateId: boundedIdentifier(),
  positionId: boundedIdentifier(),
});

export const submitVoteSchema = z.object({
  electionId: boundedIdentifier().openapi({
    description: "Election the votes are cast in",
    example: "elec_202mno",
  }),
  votes: z.array(VoteItemSchema).min(1).max(MAX_BALLOT_SELECTIONS),
});

export const SubmitVoteResponseSchema = z.object({
  message: z.string(),
});

/** Response for /votes/me: only whether the voter participated in the current election. */
export const VoteStatusSchema = z.object({
  electionId: z.string().nullable().openapi({
    description: "Current open election ID, or null if none is open",
    example: "elec_202mno",
  }),
  hasVoted: z.boolean(),
});

export const VoteCountSchema = z.object({
  candidateId: z.string(),
  candidateName: z.string(),
  positionId: z.string(),
  positionName: z.string(),
  voteCount: z.number().int(),
});

export const VoteResultsSchema = z.object({
  positionId: z.string(),
  positionName: z.string(),
  candidates: z.array(VoteCountSchema),
});

export const VoteResultsResponseSchema = z.object({
  results: z.array(VoteResultsSchema),
  meta: z.object({
    totalVotes: z.number().int(),
    totalPositions: z.number().int(),
  }),
});

export const submitVoteRoute = createRoute({
  tags: ["Votes"],
  method: "post",
  path: "/votes",
  security: [{ sessionAuth: [] }],
  middleware: bodyLimit({
    maxSize: MAX_VOTE_BODY_BYTES,
    onError: (c) =>
      c.json({ message: ERROR_MESSAGES.PAYLOAD_TOO_LARGE }, httpStatusCodes.PAYLOAD_TOO_LARGE),
  }),
  request: {
    body: jsonContentRequired(
      submitVoteSchema,
      "Vote submission details - array of candidates (one per position)",
    ),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      SubmitVoteResponseSchema,
      ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY,
    ),
    [httpStatusCodes.PAYLOAD_TOO_LARGE]: jsonContent(
      z.object({ message: z.string() }),
      ERROR_MESSAGES.PAYLOAD_TOO_LARGE,
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
    [httpStatusCodes.CONFLICT]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.VOTE_ALREADY_CAST,
    ),
    [httpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
    ),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.DUPLICATE_POSITION_VOTE,
    ),
    [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    ),
  },
});

export const getMyVotesRoute = createRoute({
  tags: ["Votes"],
  method: "get",
  path: "/votes/me",
  security: [{ sessionAuth: [] }],
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      VoteStatusSchema,
      "Whether the voter has participated in the current open election",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      ERROR_MESSAGES.UNAUTHORIZED,
    ),
  },
});

export const getVoteResultsRoute = createRoute({
  tags: ["Votes"],
  method: "get",
  path: "/votes/results",
  security: [{ sessionAuth: [] }],
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      VoteResultsResponseSchema,
      "Election results grouped by position",
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

export const getCandidateVoteCountRoute = createRoute({
  tags: ["Votes"],
  method: "get",
  path: "/votes/candidates/{id}/count",
  security: [{ sessionAuth: [] }],
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(VoteCountSchema, "Vote count for candidate"),
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
  },
});
