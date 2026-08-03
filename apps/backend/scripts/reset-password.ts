/**
 * Rehashes one account's password with the current Worker-compatible policy.
 *
 * Usage:
 *   RESET_STUDENT_ID='...' \
 *   ALLOW_REMOTE_PASSWORD_RESET=true NODE_ENV=production \
 *   pnpm db:reset-password
 *
 * The script prompts for RESET_PASSWORD without echoing it. For automation,
 * inject RESET_PASSWORD from a secrets manager instead of putting it inline.
 *
 * The operation atomically updates the password, invalidates existing sessions,
 * and clears login-attempt lockouts for the selected student number.
 */

import { createClient, type Client } from "@libsql/client";
import "dotenv/config";
import { hashPassword } from "../src/lib/password";

type ResetEnvironment = Readonly<Record<string, string | undefined>>;
type ResetClient = Pick<Client, "execute" | "batch">;

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalDatabaseUrl(url: string): boolean {
  if (url === ":memory:" || url.startsWith("file:")) {
    return true;
  }

  try {
    return LOCAL_DATABASE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function promptForPassword(): Promise<string> {
  const input = process.stdin;
  const output = process.stderr;

  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(
      new Error("RESET_PASSWORD is required when no interactive terminal is available"),
    );
  }

  return new Promise((resolve, reject) => {
    let password = "";
    let settled = false;

    const cleanup = () => {
      input.removeListener("data", onData);
      input.removeListener("end", onEnd);
      input.setRawMode(false);
      input.pause();
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      output.write("\n");

      if (error) {
        reject(error);
      } else {
        resolve(password);
      }
    };

    const onData = (chunk: Buffer | string) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          finish(new Error("Password reset cancelled"));
          return;
        }

        if (character === "\r" || character === "\n") {
          finish();
          return;
        }

        if (character === "\u007f" || character === "\b") {
          password = password.slice(0, -1);
          continue;
        }

        if (character >= " ") {
          password += character;
        }
      }
    };

    const onEnd = () => finish(new Error("Password reset cancelled"));

    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
    input.once("end", onEnd);
    output.write("Reset password: ");
  });
}

/**
 * Returns a database URL only after an explicit opt-in for remote changes.
 * This guard is intentionally separate from the seed-script safety policy:
 * password reset is allowed in production only when explicitly requested.
 */
export function getPasswordResetDatabaseUrl(env: ResetEnvironment = process.env): string {
  const url = env.TURSO_DATABASE_URL?.trim();

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required");
  }

  if (!isLocalDatabaseUrl(url) && env.ALLOW_REMOTE_PASSWORD_RESET !== "true") {
    throw new Error(
      "Remote password reset is disabled; set ALLOW_REMOTE_PASSWORD_RESET=true for an explicitly approved target",
    );
  }

  if (env.NODE_ENV?.toLowerCase() === "production" && env.ALLOW_REMOTE_PASSWORD_RESET !== "true") {
    throw new Error(
      "Refusing password reset in production without ALLOW_REMOTE_PASSWORD_RESET=true",
    );
  }

  return url;
}

/** Rehashes a single account and invalidates all authentication state for it. */
export async function resetPassword(
  client: ResetClient,
  studentId: string,
  password: string,
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  if (!studentId.trim()) {
    throw new Error("RESET_STUDENT_ID is required");
  }

  if (password.length < 8) {
    throw new Error("RESET_PASSWORD must be at least 8 characters");
  }

  const result = await client.execute({
    sql: `SELECT a.id
          FROM accounts a
          INNER JOIN users u ON u.account_id = a.id
          WHERE u.student_id = ?`,
    args: [studentId],
  });

  if (result.rows.length === 0) {
    throw new Error(`No account found for student number ${studentId}`);
  }

  if (result.rows.length > 1) {
    throw new Error(`More than one account found for student number ${studentId}`);
  }

  const accountId = String(result.rows[0]?.id);
  const passwordHash = await hashPassword(password);

  await client.batch([
    {
      sql: "UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?",
      args: [passwordHash, now, accountId],
    },
    {
      sql: "DELETE FROM sessions WHERE account_id = ?",
      args: [accountId],
    },
    {
      sql: "DELETE FROM login_attempts WHERE identifier = ?",
      args: [studentId],
    },
  ]);
}

async function main(): Promise<void> {
  const studentId = process.env.RESET_STUDENT_ID?.trim();

  if (!studentId) {
    throw new Error("RESET_STUDENT_ID is required");
  }

  const password = process.env.RESET_PASSWORD ?? (await promptForPassword());

  const client = createClient({
    url: getPasswordResetDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  await resetPassword(client, studentId, password);
  console.log(`Password reset completed for ${studentId}; existing sessions were invalidated.`);
}

if (process.argv[1]?.endsWith("reset-password.ts")) {
  main().catch((error: unknown) => {
    console.error("Password reset failed:", error);
    process.exit(1);
  });
}
