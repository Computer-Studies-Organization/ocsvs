import { createRoute, z } from "@hono/zod-openapi";
import { ResultsResponseSchema } from "@/database/openapi-schemas";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorSchema = z.object({ message: z.string() });
const IdParams = z.object({ id: z.string() });
export const getElectionResultsRoute = createRoute({
  method: "get",
  path: "/elections/{id}/results",
  tags: ["Elections"],
  request: {
    params: IdParams,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      ResultsResponseSchema,
      "Election results grouped by position",
    ),
    [httpStatusCodes.FORBIDDEN]: jsonContent(ErrorSchema, ERROR_MESSAGES.FORBIDDEN),
    [httpStatusCodes.NOT_FOUND]: jsonContent(ErrorSchema, ERROR_MESSAGES.ELECTION_NOT_FOUND),
  },
});
