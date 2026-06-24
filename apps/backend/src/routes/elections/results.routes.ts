import { createRoute, z } from "@hono/zod-openapi";
import { ResultsResponseSchema } from "@/database/openapi-schemas";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

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
  },
});
