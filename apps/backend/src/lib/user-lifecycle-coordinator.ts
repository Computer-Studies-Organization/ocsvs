import type { Database, DbClient } from "@/database/repositories/database.type";
import { accounts, sessions, users } from "@/database/schema";
import { eq, inArray, like, or } from "drizzle-orm";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { isUniqueConstraintError } from "@/lib/errors";
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  isPasswordHashSupported,
  CURRENT_COST_DUMMY_HASH,
} from "@/lib/password";
import { deleteSession, createSession } from "@/lib/session";
import { auditLogRepo } from "@/database/repositories/audit-log.repository";
import { validateProfanity } from "@/lib/profanity";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { electionRepo } from "@/database/repositories/election.repository";
import { loginAttemptRepo } from "@/database/repositories/login-attempt.repository";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

/**
 * User roles within the system.
 */
export type UserRole = "user" | "admin" | "super_admin";

/**
 * Metadata snapshot of the administrator performing an operation,
 * used for auditing and role hierarchy checks.
 */
export interface ActorInfo {
  id: string; // The account ID of the active administrator
  username: string; // The username of the administrator
  role: UserRole; // The role of the administrator
}

/**
 * Payload for registering a single user.
 */
export interface RegisterUserInput {
  firstName: string;
  lastName: string;
  studentId: string;
  course: string;
  yearLevel: string;
  username?: string | null;
  email?: string | null;
  password?: string; // Optional (e.g. if generated automatically)
  role?: UserRole;
}

/**
 * Immutable administrator details captured before a single-user creation.
 */
export interface RegisterAuditContext {
  actorAccountIdSnapshot: string;
  actorUsernameSnapshot: string;
}

/**
 * Input for updating user details.
 */
export interface UpdateUserInput {
  username?: string;
  email?: string | null;
  firstName?: string;
  lastName?: string;
  course?: string;
  yearLevel?: string;
}

/**
 * Payload for importing a single voter record.
 */
export interface ImportUserRecord {
  studentId: string;
  firstName: string;
  lastName: string;
  course: string;
  yearLevel: string;
}

/**
 * The response payload from a bulk import operation.
 */
export interface ImportResult {
  imported: {
    studentId: string;
    fullName: string;
    username: string;
    password: string; // Plaintext password generated for the voter
  }[];
  skipped: {
    studentId: string;
    reason: string;
  }[];
}

/**
 * The return payload after successful authentication.
 */
export interface AuthSuccessPayload {
  accountId: string;
  username: string;
  email: string | null;
  role: UserRole;
  sessionId: string;
  expiresAt: number;
}

/**
 * Base custom error class for the User Lifecycle Coordinator.
 */
export class UserLifecycleError extends Error {
  constructor(
    public readonly code:
      | "USER_ALREADY_EXISTS"
      | "USER_NOT_FOUND"
      | "FORBIDDEN"
      | "CANNOT_DELETE_SELF"
      | "CANNOT_DELETE_LAST_ADMIN"
      | "USER_IS_CANDIDATE"
      | "ELECTION_IS_OPEN"
      | "RATE_LIMITED_ACCOUNT"
      | "INVALID_CREDENTIALS"
      | "PASSWORD_RESET_REQUIRED"
      | "PROFANITY_DETECTED"
      | "IMPORT_CONFLICT",
    public readonly statusCode: number,
    message?: string,
    public readonly retryAfter?: number,
  ) {
    super(message || ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] || code);
    this.name = "UserLifecycleError";
  }
}

/**
 * Helper to derive base username.
 */
function getBaseUsername(firstName: string, lastName: string, studentId: string): string {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = `${cleanFirst}.${cleanLast}`;
  return base.length >= 3 ? base : studentId.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Helper to generate unique usernames during bulk import.
 */
function generateVoterUsername(
  firstName: string,
  lastName: string,
  studentId: string,
  existingUsernames: Set<string>,
): string {
  const baseUsername = getBaseUsername(firstName, lastName, studentId);
  let username = baseUsername;
  let counter = 1;
  while (existingUsernames.has(username)) {
    username = `${baseUsername}.${counter}`;
    counter++;
  }
  existingUsernames.add(username);
  return username;
}

export class UserLifecycleCoordinator {
  private generateRandomPassword(): string {
    const charset = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let rawPassword = "";
    while (rawPassword.length < 10) {
      const byte = new Uint8Array(1);
      crypto.getRandomValues(byte);
      if (byte[0] < 228) {
        rawPassword += charset[byte[0] % charset.length];
      }
    }
    return rawPassword;
  }

  async register(
    db: Database,
    input: RegisterUserInput,
    auditContext?: RegisterAuditContext,
  ): Promise<{ accountId: string; username: string }> {
    // Resolve username and handle generation if not provided
    let username = input.username;
    if (!username || !username.trim()) {
      const baseUsername = getBaseUsername(input.firstName, input.lastName, input.studentId);
      const existingAccounts = await db
        .select({ username: accounts.username })
        .from(accounts)
        .where(like(accounts.username, `${baseUsername}%`))
        .all();
      const existingSet = new Set(existingAccounts.map((a) => a.username));
      username = baseUsername;
      let counter = 1;
      while (existingSet.has(username)) {
        username = `${baseUsername}.${counter}`;
        counter++;
      }
      // This lookup cannot make allocation atomic. The accounts username unique index and
      // unique-constraint handling around voterAccountStore.create below safely return 409 on a collision.
    }

    // 1. Profanity check
    const fields = [
      { text: input.firstName, name: "firstName" },
      { text: input.lastName, name: "lastName" },
      { text: username, name: "username" },
    ];
    for (const f of fields) {
      const res = validateProfanity(f.text, f.name);
      if (!res.isClean) {
        throw new UserLifecycleError("PROFANITY_DETECTED", 400, res.message);
      }
    }

    // 2. Uniqueness checks
    const existing = await voterAccountStore.accountExists(db, username, input.email);
    if (existing) {
      throw new UserLifecycleError("USER_ALREADY_EXISTS", 409);
    }

    const studentExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.studentId, input.studentId))
      .get();
    if (studentExists) {
      throw new UserLifecycleError("USER_ALREADY_EXISTS", 409);
    }

    // 3. Resolve password and hash
    const password = input.password || this.generateRandomPassword();
    const passwordHash = await hashPassword(password);

    const accountId = crypto.randomUUID();

    try {
      await voterAccountStore.create(
        db,
        {
          accountId,
          username,
          email: input.email && input.email.trim() ? input.email : null,
          passwordHash,
          studentId: input.studentId,
          firstName: input.firstName,
          lastName: input.lastName,
          course: input.course,
          yearLevel: input.yearLevel,
          role: input.role,
        },
        auditContext && {
          action: "user.create",
          targetType: "user",
          targetId: accountId,
          ...auditContext,
          description: `Created user account: ${username} (${input.studentId})`,
        },
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new UserLifecycleError("USER_ALREADY_EXISTS", 409);
      }
      throw error;
    }

    return { accountId, username };
  }

  async bulkImport(
    db: DbClient,
    records: ImportUserRecord[],
    actor: ActorInfo,
  ): Promise<ImportResult> {
    // 1. Role verification
    if (actor.role !== "admin" && actor.role !== "super_admin") {
      throw new UserLifecycleError("FORBIDDEN", 403);
    }

    if (records.length === 0) {
      return { imported: [], skipped: [] };
    }

    // 2. Fetch existing student IDs
    const studentIdsToCheck = records.map((r) => r.studentId);
    const existingUsers = await db
      .select({ studentId: users.studentId })
      .from(users)
      .where(inArray(users.studentId, studentIdsToCheck))
      .all();

    const existingStudentIdsSet = new Set(existingUsers.map((u) => u.studentId));

    // 3. Pre-fetch existing usernames to resolve conflict in batch
    const batchBaseUsernames = [
      ...new Set(
        records.map((record) =>
          getBaseUsername(record.firstName, record.lastName, record.studentId),
        ),
      ),
    ];
    const prefixConditions = batchBaseUsernames.map((b) => like(accounts.username, `${b}%`));
    const existingAccounts =
      prefixConditions.length > 0
        ? await db
            .select({ username: accounts.username })
            .from(accounts)
            .where(or(...prefixConditions))
            .all()
        : [];

    const existingUsernamesSet = new Set(existingAccounts.map((a) => a.username));

    const imported: {
      studentId: string;
      fullName: string;
      username: string;
      password: string;
    }[] = [];

    const skipped: {
      studentId: string;
      reason: string;
    }[] = [];

    const importPayload: {
      accountId: string;
      userId: string;
      username: string;
      hashedPassword: string;
      record: ImportUserRecord;
    }[] = [];

    for (const record of records) {
      if (existingStudentIdsSet.has(record.studentId)) {
        skipped.push({
          studentId: record.studentId,
          reason: "Student ID already exists in the system",
        });
        continue;
      }
      existingStudentIdsSet.add(record.studentId);

      // Profanity check on names
      const profNameRes = validateProfanity(record.firstName, "firstName");
      const profLastRes = validateProfanity(record.lastName, "lastName");
      if (!profNameRes.isClean || !profLastRes.isClean) {
        skipped.push({
          studentId: record.studentId,
          reason: profNameRes.message || profLastRes.message || "Profanity detected in name",
        });
        continue;
      }

      const rawPassword = this.generateRandomPassword();
      const hashedPassword = await hashPassword(rawPassword);
      const username = generateVoterUsername(
        record.firstName,
        record.lastName,
        record.studentId,
        existingUsernamesSet,
      );

      const accountId = crypto.randomUUID();
      const userId = crypto.randomUUID();

      importPayload.push({
        accountId,
        userId,
        username,
        hashedPassword,
        record,
      });

      imported.push({
        studentId: record.studentId,
        fullName: `${record.firstName} ${record.lastName}`.trim().toUpperCase(),
        username,
        password: rawPassword,
      });
    }

    if (importPayload.length > 0) {
      try {
        await db.transaction(async (tx) => {
          // Batch insert accounts
          const accountValues = importPayload.map((item) => ({
            id: item.accountId,
            role: "user" as const,
            username: item.username,
            password_hash: item.hashedPassword,
          }));
          await tx.insert(accounts).values(accountValues);

          // Batch insert users
          const userValues = importPayload.map((item) => ({
            id: item.userId,
            accountId: item.accountId,
            studentId: item.record.studentId,
            firstName: item.record.firstName,
            lastName: item.record.lastName,
            course: item.record.course,
            yearLevel: item.record.yearLevel,
          }));
          await tx.insert(users).values(userValues);

          // Audit logging
          await auditLogRepo.insert(tx, {
            action: "user.bulk_import",
            targetType: "user",
            targetId: crypto.randomUUID(),
            actorAccountIdSnapshot: actor.id,
            actorUsernameSnapshot: actor.username,
            description: `Bulk imported ${imported.length} voter account${imported.length !== 1 ? "s" : ""}${skipped.length > 0 ? ` (${skipped.length} skipped)` : ""}`,
          });
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new UserLifecycleError("IMPORT_CONFLICT", 409);
        }
        throw err;
      }
    }

    return { imported, skipped };
  }

  async update(
    db: DbClient,
    userId: string,
    input: UpdateUserInput,
    actor: ActorInfo,
  ): Promise<void> {
    // 1. Role verification
    if (actor.role !== "admin" && actor.role !== "super_admin") {
      throw new UserLifecycleError("FORBIDDEN", 403);
    }

    try {
      await db.transaction(async (tx) => {
        // 2. Fetch user inside transaction (prevents TOCTOU)
        const user = await voterAccountStore.getAccountDeleteStatus(tx, userId);
        if (!user) {
          throw new UserLifecycleError("USER_NOT_FOUND", 404);
        }

        // 3. Admin hierarchy checks
        const isTargetAdmin = user.role === "admin" || user.role === "super_admin";
        if (isTargetAdmin && actor.role !== "super_admin") {
          throw new UserLifecycleError("FORBIDDEN", 403, ERROR_MESSAGES.CANNOT_UPDATE_ADMIN);
        }

        // 4. Validate inputs & uniqueness
        if (input.username) {
          const profRes = validateProfanity(input.username, "username");
          if (!profRes.isClean) {
            throw new UserLifecycleError("PROFANITY_DETECTED", 400, profRes.message);
          }

          const exists = await voterAccountStore.usernameExists(tx, input.username, user.accountId);
          if (exists) {
            throw new UserLifecycleError(
              "USER_ALREADY_EXISTS",
              409,
              ERROR_MESSAGES.USERNAME_ALREADY_EXISTS,
            );
          }
        }

        if (input.firstName) {
          const profRes = validateProfanity(input.firstName, "firstName");
          if (!profRes.isClean) {
            throw new UserLifecycleError("PROFANITY_DETECTED", 400, profRes.message);
          }
        }

        if (input.lastName) {
          const profRes = validateProfanity(input.lastName, "lastName");
          if (!profRes.isClean) {
            throw new UserLifecycleError("PROFANITY_DETECTED", 400, profRes.message);
          }
        }

        // 5. Update atomic tables
        const accountFields: Record<string, any> = {};
        if (input.username !== undefined) accountFields.username = input.username;
        if (input.email !== undefined) {
          accountFields.email = input.email && input.email.trim() ? input.email : null;
        }
        if (Object.keys(accountFields).length > 0) {
          await voterAccountStore.updateAccount(tx, user.accountId, accountFields);
        }

        const userFields: Record<string, any> = {};
        if (input.firstName !== undefined) userFields.firstName = input.firstName;
        if (input.lastName !== undefined) userFields.lastName = input.lastName;
        if (input.course !== undefined) userFields.course = input.course;
        if (input.yearLevel !== undefined) userFields.yearLevel = input.yearLevel;
        if (Object.keys(userFields).length > 0) {
          await voterAccountStore.updateUser(tx, userId, userFields);
        }

        // 6. Write audit log
        await auditLogRepo.insert(tx, {
          action: "user.update",
          targetType: "user",
          targetId: userId,
          actorAccountIdSnapshot: actor.id,
          actorUsernameSnapshot: actor.username,
        });
      });
    } catch (error) {
      if (error instanceof UserLifecycleError) {
        throw error;
      }
      if (isUniqueConstraintError(error)) {
        throw new UserLifecycleError(
          "USER_ALREADY_EXISTS",
          409,
          ERROR_MESSAGES.USERNAME_ALREADY_EXISTS,
        );
      }
      throw error;
    }
  }

  async softDelete(db: DbClient, userId: string, actor: ActorInfo): Promise<void> {
    // 1. Role verification
    if (actor.role !== "admin" && actor.role !== "super_admin") {
      throw new UserLifecycleError("FORBIDDEN", 403);
    }

    await db.transaction(async (tx) => {
      // 2. Fetch user inside transaction (prevents TOCTOU)
      const user = await voterAccountStore.getAccountDeleteStatus(tx, userId);
      if (!user) {
        throw new UserLifecycleError("USER_NOT_FOUND", 404);
      }

      if (user.deletedAt !== null) {
        throw new UserLifecycleError("FORBIDDEN", 400, ERROR_MESSAGES.USER_ALREADY_ARCHIVED);
      }

      // 3. Self-deletion guard
      if (actor.id === user.accountId) {
        throw new UserLifecycleError("CANNOT_DELETE_SELF", 400);
      }

      // 4. Admin checks
      const isTargetAdmin = user.role === "admin" || user.role === "super_admin";
      if (isTargetAdmin) {
        if (actor.role !== "super_admin") {
          throw new UserLifecycleError("FORBIDDEN", 403, ERROR_MESSAGES.CANNOT_DELETE_ADMIN);
        }

        const adminCount = await voterAccountStore.countActiveAdminsAndSuperAdmins(tx);
        if (adminCount <= 1) {
          throw new UserLifecycleError("CANNOT_DELETE_LAST_ADMIN", 400);
        }
      }

      // 5. Invalidate sessions and soft delete
      await voterAccountStore.softDelete(tx, user.accountId);
      await tx.delete(sessions).where(eq(sessions.accountId, user.accountId)).run();

      // Audit log entry
      await auditLogRepo.insert(tx, {
        action: "user.soft_delete",
        targetType: "user",
        targetId: userId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });
  }

  async restore(db: DbClient, userId: string, actor: ActorInfo): Promise<void> {
    // 1. Role verification
    if (actor.role !== "admin" && actor.role !== "super_admin") {
      throw new UserLifecycleError("FORBIDDEN", 403);
    }

    await db.transaction(async (tx) => {
      // 2. Fetch user inside transaction (prevents TOCTOU)
      const user = await voterAccountStore.getAccountDeleteStatus(tx, userId);
      if (!user) {
        throw new UserLifecycleError("USER_NOT_FOUND", 404);
      }

      if (user.deletedAt === null) {
        throw new UserLifecycleError("FORBIDDEN", 400, "User is not archived");
      }

      // 3. Admin check
      const isTargetAdmin = user.role === "admin" || user.role === "super_admin";
      if (isTargetAdmin && actor.role !== "super_admin") {
        throw new UserLifecycleError("FORBIDDEN", 403, ERROR_MESSAGES.CANNOT_RESTORE_ADMIN);
      }

      // 4. Restore
      await voterAccountStore.restore(tx, user.accountId);

      await auditLogRepo.insert(tx, {
        action: "user.restore",
        targetType: "user",
        targetId: userId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });
  }

  async hardDelete(db: DbClient, userId: string, actor: ActorInfo): Promise<void> {
    // 1. Role verification
    if (actor.role !== "admin" && actor.role !== "super_admin") {
      throw new UserLifecycleError("FORBIDDEN", 403);
    }

    await db.transaction(async (tx) => {
      // 2. Fetch user inside transaction (prevents TOCTOU)
      const user = await voterAccountStore.getAccountDeleteStatus(tx, userId);
      if (!user) {
        throw new UserLifecycleError("USER_NOT_FOUND", 404);
      }

      // 3. Self-deletion guard
      if (actor.id === user.accountId) {
        throw new UserLifecycleError("CANNOT_DELETE_SELF", 400);
      }

      // 4. Admin checks
      const isTargetAdmin = user.role === "admin" || user.role === "super_admin";
      if (isTargetAdmin) {
        if (actor.role !== "super_admin") {
          throw new UserLifecycleError("FORBIDDEN", 403, ERROR_MESSAGES.CANNOT_DELETE_ADMIN);
        }

        if (user.deletedAt === null) {
          const adminCount = await voterAccountStore.countActiveAdminsAndSuperAdmins(tx);
          if (adminCount <= 1) {
            throw new UserLifecycleError("CANNOT_DELETE_LAST_ADMIN", 400);
          }
        }
      }

      // 5. Candidate check
      const isCandidate = await candidateRepo.isCandidate(tx, user.accountId);
      if (isCandidate) {
        throw new UserLifecycleError("USER_IS_CANDIDATE", 400);
      }

      // 6. Open election check: cannot delete users while an election is open
      const openElection = await electionRepo.findOpen(tx);
      if (openElection) {
        throw new UserLifecycleError(
          "ELECTION_IS_OPEN",
          400,
          "Cannot delete users while an election is open",
        );
      }

      // 7. Hard deletion
      const details = await voterAccountStore.findById(tx, userId);
      const username = details?.username ?? "unknown";
      const studentId = details?.studentId ?? "unknown";

      await voterAccountStore.hardDelete(tx, user.accountId);

      // Audit log entry
      await auditLogRepo.insert(tx, {
        action: "user.hard_delete",
        targetType: "user",
        targetId: userId,
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
        description: `Permanently deleted: ${username} (${studentId})`,
      });
    });
  }

  async authenticate(
    db: DbClient,
    studentNumber: string,
    password: string,
    clientIp: string,
  ): Promise<AuthSuccessPayload> {
    const dummyHash = CURRENT_COST_DUMMY_HASH;

    // 1. Lockout window checks
    await loginAttemptRepo.deleteExpiredAttempts(db, studentNumber, 900);
    const attemptsList = await loginAttemptRepo.getRecentAttempts(db, studentNumber, 900);
    const attempts = attemptsList.length;

    if (attempts >= 5) {
      const oldest = attemptsList[0]?.attemptedAt ?? 0;
      const retryAfter = Math.max(1, oldest + 900 - Math.floor(Date.now() / 1000));
      // Constant-time hash verification to prevent timing analysis
      await verifyPassword(password, dummyHash);
      throw new UserLifecycleError(
        "RATE_LIMITED_ACCOUNT",
        429,
        `Account locked out. Retry after ${retryAfter} seconds.`,
        retryAfter,
      );
    }

    // 2. Fetch voter profile
    const result = await voterAccountStore.findByStudentId(db, studentNumber);

    if (!result || result.deletedAt !== null) {
      // Run slow verification to prevent timing checks
      await verifyPassword(password, dummyHash);
      await loginAttemptRepo.recordAttempt(db, studentNumber, clientIp);
      throw new UserLifecycleError("INVALID_CREDENTIALS", 401);
    }

    // 3. Verify credentials
    if (!isPasswordHashSupported(result.password_hash)) {
      throw new UserLifecycleError("PASSWORD_RESET_REQUIRED", 401);
    }

    const isValid = await verifyPassword(password, result.password_hash);
    if (!isValid) {
      await loginAttemptRepo.recordAttempt(db, studentNumber, clientIp);
      throw new UserLifecycleError("INVALID_CREDENTIALS", 401);
    }

    // 4. Rehash legacy/below-current hashes with the current policy on successful login
    if (needsRehash(result.password_hash)) {
      try {
        await voterAccountStore.updatePassword(db, result.id, await hashPassword(password));
      } catch {
        // Rehashing is opportunistic; verified credentials must still be allowed to log in.
      }
    }

    // 5. Successful login
    await loginAttemptRepo.clearAttempts(db, studentNumber);
    const session = await createSession(db as any, result.id);

    return {
      accountId: result.id,
      username: result.username,
      email: result.email,
      role: result.role as UserRole,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    };
  }

  async logout(db: DbClient, sessionId: string): Promise<void> {
    await deleteSession(db as any, sessionId);
  }

  async unlock(db: DbClient, userId: string, actor: ActorInfo): Promise<void> {
    if (actor.role !== "admin" && actor.role !== "super_admin") {
      throw new UserLifecycleError("FORBIDDEN", 403);
    }
    const user = await voterAccountStore.findById(db, userId);
    if (!user) {
      throw new UserLifecycleError("USER_NOT_FOUND", 404);
    }
    const tx = db as any;
    await loginAttemptRepo.clearAttempts(tx, user.studentId);

    await auditLogRepo.insert(tx, {
      action: "user.unlock",
      targetType: "user",
      targetId: user.id,
      actorAccountIdSnapshot: actor.id,
      actorUsernameSnapshot: actor.username,
      description: `Unlocked account for student: ${user.studentId}`,
    });
  }
}

// Singleton production coordinator instance
export const userLifecycleCoordinator = new UserLifecycleCoordinator();
