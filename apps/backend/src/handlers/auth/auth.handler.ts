import type { AppRouteHandler } from "@/lib/types/app-types";
import type { loginRoute, logoutRoute, meRoute } from "@/routes/auth/routes";
import { createDb } from "@/config/db";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { getClientIp } from "@/middleware/rate-limit";
import { clearSessionCookie, getSessionIdFromCookie, setSessionCookie } from "@/lib/session";
import { userLifecycleCoordinator, UserLifecycleError } from "@/lib/user-lifecycle-coordinator";
import * as httpStatusCodes from "@/openapi/http-status-codes";

/** Mask student number for logging — keep last 4 chars for correlation. */
function maskStudentId(id: string): string {
  if (id.length <= 4) return "****";
  return "*".repeat(id.length - 4) + id.slice(-4);
}

export const login: AppRouteHandler<typeof loginRoute> = async (c) => {
  const { studentNumber, password } = c.req.valid("json");
  const { db } = createDb(c);
  const clientIp = getClientIp(c);

  c.var.logger.info({ studentNumber: maskStudentId(studentNumber) }, "Login attempt");

  try {
    const payload = await userLifecycleCoordinator.authenticate(
      db,
      studentNumber,
      password,
      clientIp,
    );

    // Set session cookie
    setSessionCookie(c, payload.sessionId, payload.expiresAt);

    return c.json(
      {
        message: ERROR_MESSAGES.USER_LOGGED_IN_SUCCESSFULLY,
        user: {
          id: payload.accountId,
          email: payload.email,
          username: payload.username,
          role: payload.role,
        },
      },
      httpStatusCodes.OK,
    );
  } catch (error) {
    if (error instanceof UserLifecycleError) {
      if (error.code === "RATE_LIMITED_ACCOUNT") {
        c.var.logger.warn({ studentNumber: maskStudentId(studentNumber) }, "Account locked out");
        if (error.retryAfter !== undefined) {
          c.header("Retry-After", String(error.retryAfter));
        }
        return c.json(
          { message: ERROR_MESSAGES.RATE_LIMITED_ACCOUNT },
          httpStatusCodes.TOO_MANY_REQUESTS,
        );
      }
      if (error.code === "INVALID_CREDENTIALS") {
        c.var.logger.warn({ studentNumber: maskStudentId(studentNumber) }, "Invalid credentials");
        return c.json(
          { message: ERROR_MESSAGES.INVALID_CREDENTIALS },
          httpStatusCodes.UNAUTHORIZED,
        );
      }
      return c.json({ message: error.message }, error.statusCode as any);
    }
    throw error;
  }
};

export const logout: AppRouteHandler<typeof logoutRoute> = async (c) => {
  const { db } = createDb(c);
  const sessionId = getSessionIdFromCookie(c);

  if (sessionId) {
    await userLifecycleCoordinator.logout(db, sessionId);
  }

  clearSessionCookie(c);

  return c.json({ message: ERROR_MESSAGES.LOGGED_OUT_SUCCESSFULLY }, httpStatusCodes.OK);
};

export const me: AppRouteHandler<typeof meRoute> = async (c) => {
  const account = c.var.authUser;

  return c.json(
    {
      user: {
        id: account.id,
        email: account.email,
        username: account.username,
        role: account.role,
      },
    },
    httpStatusCodes.OK,
  );
};
