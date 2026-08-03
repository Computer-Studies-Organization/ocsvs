/**
 * Seed script: creates a test voter account + user record in the local database.
 *
 * Usage:
 *   VOTER_PASSWORD='...' pnpm db:seed-voter
 *
 * Requires a local database URL by default. Set ALLOW_REMOTE_SEEDING=true only
 * for an explicitly approved non-production remote target.
 * Safe to run multiple times - skips if the voter account already exists.
 */

import { createClient } from "@libsql/client";
import "dotenv/config";
import { hashPassword } from "../src/lib/password";
import { getSeedDatabaseUrl, getSeedPassword } from "./seed-utils";

// --- Config ---

const VOTER = {
  accountId: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  username: "voter",
  email: "voter@cso.dev",
  studentId: "C25-01-10001-BSC001",
  firstName: "Test",
  lastName: "Voter",
  course: "BSCS",
  yearLevel: "1st Year",
};

// --- Main ---

async function main() {
  const url = getSeedDatabaseUrl();

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  // Check if voter already exists
  const existing = await client.execute({
    sql: "SELECT id FROM accounts WHERE username = ?",
    args: [VOTER.username],
  });

  if (existing.rows.length > 0) {
    console.log(
      `Voter account "${VOTER.username}" already exists (id: ${existing.rows[0].id}). Skipping.`,
    );
    return;
  }

  const password = getSeedPassword(process.env, "VOTER_PASSWORD");
  const passwordHash = await hashPassword(password);
  const now = Math.floor(Date.now() / 1000);

  await client.batch([
    {
      sql: `INSERT INTO accounts (id, username, email, password_hash, role, created_at, updated_at, last_login)
            VALUES (?, ?, ?, ?, 'user', ?, ?, ?)`,
      args: [VOTER.accountId, VOTER.username, VOTER.email, passwordHash, now, now, now],
    },
    {
      sql: `INSERT INTO users (id, account_id, student_id, first_name, last_name, course, year_level, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        VOTER.userId,
        VOTER.accountId,
        VOTER.studentId,
        VOTER.firstName,
        VOTER.lastName,
        VOTER.course,
        VOTER.yearLevel,
        now,
        now,
      ],
    },
  ]);

  console.log("Voter account seeded successfully!");
  console.log(`  Username:   ${VOTER.username}`);
  console.log(`  Student ID: ${VOTER.studentId}`);
  console.log(`  Role:       user`);
  console.log(`  Account ID: ${VOTER.accountId}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
