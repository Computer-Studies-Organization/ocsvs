import { createRoute, z } from "@hono/zod-openapi";
import { VotingStateSchema } from "@/database/openapi-schemas";
import jsonContent from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

const ErrorSchema = z.object({ message: z.string() });

export const votingStateRoute = createRoute({
  method: "get",
  path: "/elections/state",
  tags: ["Elections"],
  responses: {
    [httpStatusCodes.OK]: jsonContent(VotingStateSchema, "Composite voting-state view"),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(ErrorSchema, "Unauthorized"),
  },
});
