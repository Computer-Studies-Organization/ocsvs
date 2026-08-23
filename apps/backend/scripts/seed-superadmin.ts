/**
 * Seed script: creates a super_admin account + user record in the database.
 *
 * Usage:
 *   SUPERADMIN_PASSWORD='...' pnpm db:seed-superadmin
 *
 * Requires a local database URL by default. Set ALLOW_REMOTE_SEEDING=true only
 * for an explicitly approved non-production remote target.
 * Safe to run multiple times - deletes invalid old superadmin first, skips if already exists.
 */

import { createClient } from "@libsql/client";
import "dotenv/config";
import { hashPassword } from "../src/lib/password";
import { getSeedDatabaseUrl, getSeedPassword } from "./seed-utils";

// --- Config ---

const SUPERADMIN = {
  accountId: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  username: "superadmin",
  email: "superadmin@cso.dev",
  studentId: "C24-01-99999-SAD001", // SAD001 matches regex ^C\d{2}-\d{2}-\d{4,6}-[A-Z]{3}\d{3}$
  firstName: "Super",
  lastName: "Admin",
  course: "BSCS",
  yearLevel: "4th Year",
};

// --- Main ---

async function main() {
  const url = getSeedDatabaseUrl();

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  // Clean up any previously seeded invalid superadmin (with student ID C24-01-99999-SA0001)
  const oldSuperadmin = await client.execute({
    sql: "SELECT id FROM accounts WHERE username = ?",
    args: ["superadmin"],
  });

  if (oldSuperadmin.rows.length > 0) {
    const oldAccountId = oldSuperadmin.rows[0].id as string;

    // Check if it's the old invalid one
    const checkUser = await client.execute({
      sql: "SELECT student_id FROM users WHERE account_id = ?",
      args: [oldAccountId],
    });

    if (checkUser.rows.length > 0 && checkUser.rows[0].student_id === "C24-01-99999-SA0001") {
      console.log("Found old invalid superadmin account C24-01-99999-SA0001. Cleaning up...");
      await client.batch([
        {
          sql: "DELETE FROM users WHERE account_id = ?",
          args: [oldAccountId],
        },
        {
          sql: "DELETE FROM accounts WHERE id = ?",
          args: [oldAccountId],
        },
      ]);
      console.log("Cleanup completed.");
    }
  }

  // Check if superadmin already exists (either by username or studentId)
  const existing = await client.execute({
    sql: `SELECT a.id, u.student_id
          FROM accounts a
          LEFT JOIN users u ON a.id = u.account_id
          WHERE a.username = ? OR u.student_id = ?`,
    args: [SUPERADMIN.username, SUPERADMIN.studentId],
  });

  if (existing.rows.length > 0) {
    console.log(
      `Superadmin account already exists (username: "${SUPERADMIN.username}", studentId: "${existing.rows[0].student_id}"). Skipping.`,
    );
    return;
  }

  const password = getSeedPassword(process.env, "SUPERADMIN_PASSWORD");
  const passwordHash = await hashPassword(password);
  const now = Math.floor(Date.now() / 1000);

  await client.batch([
    {
      sql: `INSERT INTO accounts (id, username, email, password_hash, role, created_at, updated_at, last_login)
            VALUES (?, ?, ?, ?, 'super_admin', ?, ?, ?)`,
      args: [
        SUPERADMIN.accountId,
        SUPERADMIN.username,
        SUPERADMIN.email,
        passwordHash,
        now,
        now,
        now,
      ],
    },
    {
      sql: `INSERT INTO users (id, account_id, student_id, first_name, last_name, course, year_level, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        SUPERADMIN.userId,
        SUPERADMIN.accountId,
        SUPERADMIN.studentId,
        SUPERADMIN.firstName,
        SUPERADMIN.lastName,
        SUPERADMIN.course,
        SUPERADMIN.yearLevel,
        now,
        now,
      ],
    },
  ]);

  console.log("Superadmin account seeded successfully!");
  console.log(`  Username/Student ID: ${SUPERADMIN.studentId}`);
  console.log(`  Username:            ${SUPERADMIN.username}`);
  console.log(`  Role:                super_admin`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
