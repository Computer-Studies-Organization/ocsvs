import { createRoute, z } from "@hono/zod-openapi";
import { TooManyRequestsSchema } from "@/database/openapi-schemas";
import jsonContent, { jsonContentRequired } from "@/middleware/utils/json-content";
import * as httpStatusCodes from "@/openapi/http-status-codes";

export const loginSchema = z.object({
  studentNumber: z
    .string()
    .regex(/^C\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}$/, "Invalid Student ID format"),
  password: z.string(),
  turnstileToken: z.string().optional().openapi({
    description: "Cloudflare Turnstile token for client-side bot verification",
    example: "0.XT-...",
  }),
});

export const loginRoute = createRoute({
  tags: ["Auth"],
  method: "post",
  path: "/login",
  request: {
    body: jsonContentRequired(loginSchema, "User login credentials"),
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
        user: z.object({
          id: z.string(),
          email: z.string().nullable(),
          username: z.string(),
          role: z.string(),
        }),
      }),
      "User logged in successfully (session cookie set)",
    ),
    [httpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Invalid request",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized",
    ),
    [httpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Internal server error",
    ),
    [httpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(
      TooManyRequestsSchema,
      "Too many requests - rate limit exceeded (per-IP or per-account lockout)",
    ),
  },
});

export const logoutRoute = createRoute({
  tags: ["Auth"],
  method: "post",
  path: "/logout",
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "User logged out successfully",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized - no active session",
    ),
  },
});

export const meRoute = createRoute({
  tags: ["Auth"],
  method: "get",
  path: "/me",
  responses: {
    [httpStatusCodes.OK]: jsonContent(
      z.object({
        user: z.object({
          id: z.string(),
          email: z.string().nullable(),
          username: z.string(),
          role: z.string(),
        }),
      }),
      "Current authenticated user",
    ),
    [httpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({
        message: z.string(),
      }),
      "Unauthorized - no active session",
    ),
  },
});
