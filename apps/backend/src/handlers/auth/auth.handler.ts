import type { AppRouteHandler } from "@/lib/types/app-types";
import type { loginRoute, logoutRoute, meRoute, registerRoute } from "@/routes/auth/routes";
import { createDb } from "@/config/db";
import { userAccountQueries } from "@/database/queries/user-account.queries";
import { accountRepo } from "@/database/repositories/account.repository";
import { loginAttemptRepo } from "@/database/repositories/login-attempt.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { isUniqueConstraintError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getClientIp } from "@/middleware/rate-limit";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionIdFromCookie,
  setSessionCookie,
} from "@/lib/session";
import * as httpStatusCodes from "@/openapi/http-status-codes";

/** Dummy hash for constant-time comparison on user-not-found path (prevents timing attacks). */
const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** Per-identifier lockout: max failed attempts before temporary block. */
const MAX_LOGIN_ATTEMPTS = 5;
/** Per-identifier lockout: rolling window in seconds (15 min). */
const LOGIN_WINDOW_SECONDS = 900;

/** Mask student number for logging — keep last 4 chars for correlation. */
function maskStudentId(id: string): string {
  if (id.length <= 4) return "****";
  return "*".repeat(id.length - 4) + id.slice(-4);
}

export const register: AppRouteHandler<typeof registerRoute> = async (c) => {
  const { firstName, lastName, email, username, password, studentId, course, yearLevel } =
    c.req.valid("json");
  const { db } = createDb(c);

  const existing = await accountRepo.accountExists(db, username, email);

  if (existing) {
    return c.json({ message: ERROR_MESSAGES.USER_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
  }

  const accountId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await accountRepo.create(db, {
      accountId,
      username,
      email: email && email.trim() ? email : null,
      passwordHash,
      studentId,
      firstName,
      lastName,
      course,
      yearLevel,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return c.json({ message: ERROR_MESSAGES.USER_ALREADY_EXISTS }, httpStatusCodes.CONFLICT);
    }
    throw error;
  }

  return c.json(
    {
      message: ERROR_MESSAGES.USER_REGISTERED_SUCCESSFULLY,
      user: {
        id: accountId,
        email,
        username,
        role: "user",
        studentId,
      },
    },
    httpStatusCodes.OK,
  );
};

export const login: AppRouteHandler<typeof loginRoute> = async (c) => {
  const { studentNumber, password } = c.req.valid("json");
  const { db } = createDb(c);
  const clientIp = getClientIp(c);

  c.var.logger.info({ studentNumber: maskStudentId(studentNumber) }, "Login attempt");

  // Prune stale rows first to prevent phantom lockouts from attempts outside the
  // current window that were never cleaned up (e.g. after a crash or cold start).
  await loginAttemptRepo.deleteExpiredAttempts(db, studentNumber, LOGIN_WINDOW_SECONDS);
  const recentAttempts = await loginAttemptRepo.getRecentAttempts(
    db,
    studentNumber,
    LOGIN_WINDOW_SECONDS,
  );

  if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
    // getRecentAttempts orders ASC; [0] is the oldest attempt in the window.
    const oldest = recentAttempts[0].attemptedAt;
    const retryAfter = Math.max(1, oldest + LOGIN_WINDOW_SECONDS - Math.floor(Date.now() / 1000));
    c.var.logger.warn({ studentNumber: maskStudentId(studentNumber) }, "Account locked out");
    c.header("Retry-After", String(retryAfter));
    return c.json(
      { message: ERROR_MESSAGES.RATE_LIMITED_ACCOUNT },
      httpStatusCodes.TOO_MANY_REQUESTS,
    );
  }

  const result = await userAccountQueries.findByStudentId(db, studentNumber);

  if (!result) {
    c.var.logger.warn({ studentNumber: maskStudentId(studentNumber) }, "User not found");
    await verifyPassword(password, DUMMY_HASH);
    await loginAttemptRepo.recordAttempt(db, studentNumber, clientIp);
    return c.json({ message: ERROR_MESSAGES.INVALID_CREDENTIALS }, httpStatusCodes.UNAUTHORIZED);
  }

  if (result.deletedAt !== null) {
    c.var.logger.warn({ studentNumber: maskStudentId(studentNumber) }, "User deleted");
    await loginAttemptRepo.recordAttempt(db, studentNumber, clientIp);
    return c.json({ message: ERROR_MESSAGES.INVALID_CREDENTIALS }, httpStatusCodes.UNAUTHORIZED);
  }

  const isValid = await verifyPassword(password, result.password_hash);
  c.var.logger.debug(
    { studentNumber: maskStudentId(studentNumber) },
    "Password verification complete",
  );

  if (!isValid) {
    await loginAttemptRepo.recordAttempt(db, studentNumber, clientIp);
    return c.json({ message: ERROR_MESSAGES.INVALID_CREDENTIALS }, httpStatusCodes.UNAUTHORIZED);
  }

  await loginAttemptRepo.clearAttempts(db, studentNumber);

  // Create session and set cookie
  const session = await createSession(db, result.id);
  setSessionCookie(c, session.id, session.expiresAt);

  return c.json(
    {
      message: ERROR_MESSAGES.USER_LOGGED_IN_SUCCESSFULLY,
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        role: result.role,
      },
    },
    httpStatusCodes.OK,
  );
};

export const logout: AppRouteHandler<typeof logoutRoute> = async (c) => {
  const { db } = createDb(c);
  const sessionId = getSessionIdFromCookie(c);

  if (sessionId) {
    await deleteSession(db, sessionId);
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
