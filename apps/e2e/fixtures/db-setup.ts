import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OFFLINE_DATABASE_URL = "http://127.0.0.1:8080";
export const OFFLINE_DATABASE_TOKEN = "offline-local-token";

if (process.env.OFFLINE_DEV === "false") {
  dotenv.config({ path: path.join(__dirname, "../../backend/.env") });
}

function getDatabaseUrl(): string {
  const offline = process.env.OFFLINE_DEV !== "false";
  const dbUrl = process.env.TURSO_DATABASE_URL?.trim() || OFFLINE_DATABASE_URL;

  if (offline) {
    try {
      const parsed = new URL(dbUrl);
      const isLocal =
        parsed.protocol === "http:" &&
        parsed.port === "8080" &&
        ["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname);
      if (!isLocal) throw new Error();
    } catch {
      throw new Error(
        `Offline E2E requires a local HTTP database at ${OFFLINE_DATABASE_URL}; refusing ${dbUrl}`,
      );
    }
  }

  return dbUrl;
}

export function createTestDatabaseClient() {
  const url = getDatabaseUrl();
  return createClient({
    url,
    authToken:
      process.env.TURSO_AUTH_TOKEN ||
      (process.env.OFFLINE_DEV !== "false" ? OFFLINE_DATABASE_TOKEN : undefined),
  });
}

const ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;

function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH,
  );

  return `${toBase64(salt)}$${toBase64(new Uint8Array(derivedKey))}`;
}

export const TEST_USERS = {
  admin: {
    accountId: "e2e-admin-account-id",
    userId: "e2e-admin-user-id",
    username: "e2e_admin",
    email: "e2e_admin@cso.dev",
    password: "Admin123!",
    studentId: "C24-01-99999-BSC001",
    firstName: "E2EAdmin",
    lastName: "User",
    course: "BSCS",
    yearLevel: "4th Year",
    role: "super_admin",
  },
  voter: {
    accountId: "e2e-voter-account-id",
    userId: "e2e-voter-user-id",
    username: "e2e_voter",
    email: "e2e_voter@cso.dev",
    password: "Voter123!",
    studentId: "C25-01-99999-BSC001",
    firstName: "E2EVoter",
    lastName: "User",
    course: "BSCS",
    yearLevel: "1st Year",
    role: "user",
  },
  votedVoter: {
    accountId: "e2e-voted-voter-account-id",
    userId: "e2e-voted-voter-user-id",
    username: "e2e_voted_voter",
    email: "e2e_voted_voter@cso.dev",
    password: "Voter123!",
    studentId: "C25-01-99999-BSC002",
    firstName: "E2EVotedVoter",
    lastName: "User",
    course: "BSCS",
    yearLevel: "1st Year",
    role: "user",
  },
};

export const DRAFT_CANDIDATE = {
  electionId: "e2e-draft-election-id",
  positionId: "e2e-draft-position-president",
  candidateId: "e2e-draft-candidate-id",
};

export async function seedTestUsers() {
  const client = createTestDatabaseClient();

  const now = Math.floor(Date.now() / 1000);

  for (const userKey of ["admin", "voter", "votedVoter"] as const) {
    const u = TEST_USERS[userKey];
    const existing = await client.execute({
      sql: "SELECT id FROM accounts WHERE username = ? OR id = ?",
      args: [u.username, u.accountId],
    });

    const passwordHash = await hashPassword(u.password);
    if (existing.rows.length === 0) {
      await client.batch([
        {
          sql: `INSERT INTO accounts (id, username, email, password_hash, role, created_at, updated_at, last_login)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [u.accountId, u.username, u.email, passwordHash, u.role, now, now, now],
        },
        {
          sql: `INSERT INTO users (id, account_id, student_id, first_name, last_name, course, year_level, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            u.userId,
            u.accountId,
            u.studentId,
            u.firstName,
            u.lastName,
            u.course,
            u.yearLevel,
            now,
            now,
          ],
        },
      ]);
    } else {
      await client.execute({
        sql: `UPDATE accounts SET deleted_at = NULL, password_hash = ?, updated_at = ? WHERE id = ?`,
        args: [passwordHash, now, u.accountId],
      });
    }
  }
}

export async function seedActiveElection() {
  const client = createTestDatabaseClient();

  const now = Math.floor(Date.now() / 1000);
  const electionId = "e2e-open-election-id";
  const posPresId = "e2e-pos-president";
  const posVpId = "e2e-pos-vice-president";
  const candPres1Id = "e2e-cand-pres-1";
  const candPres2Id = "e2e-cand-pres-2";
  const candVp1Id = "e2e-cand-vp-1";

  // Ensure user fixture accounts exist first
  await seedTestUsers();

  await client.execute({
    sql: "UPDATE elections SET status = 'closed' WHERE status = 'open' AND id != ?",
    args: [electionId],
  });
  await client.execute({
    sql: "DELETE FROM votes WHERE user_id = ?",
    args: [TEST_USERS.votedVoter.userId],
  });

  await client.batch([
    {
      sql: `INSERT OR IGNORE INTO elections (id, name, description, status, opens_at, closes_at, created_at, updated_at)
            VALUES (?, ?, ?, 'open', ?, ?, ?, ?)`,
      args: [
        electionId,
        "E2E Active Student Council Election",
        "Active election created for Playwright E2E UI testing",
        now - 3600,
        now + 86400,
        now,
        now,
      ],
    },
    {
      sql: "UPDATE elections SET status = 'open', opens_at = ?, closes_at = ?, updated_at = ? WHERE id = ?",
      args: [now - 3600, now + 86400, now, electionId],
    },
    {
      sql: `INSERT OR IGNORE INTO positions (id, election_id, name, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [posPresId, electionId, "President", 1, now, now],
    },
    {
      sql: `INSERT OR IGNORE INTO positions (id, election_id, name, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [posVpId, electionId, "Vice President", 2, now, now],
    },
    {
      sql: `INSERT OR IGNORE INTO candidates (id, full_name, account_id, position_id, manifesto, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        candPres1Id,
        "Alice President",
        TEST_USERS.admin.accountId,
        posPresId,
        "Better campus facilities and student welfare",
        now,
        now,
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO candidates (id, full_name, account_id, position_id, manifesto, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        candPres2Id,
        "Bob President",
        TEST_USERS.voter.accountId,
        posPresId,
        "Technology-driven campus initiatives",
        now,
        now,
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO candidates (id, full_name, account_id, position_id, manifesto, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        candVp1Id,
        "Charlie VP",
        TEST_USERS.admin.accountId,
        posVpId,
        "Unity, transparency, and action",
        now,
        now,
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO votes (id, user_id, candidate_id, position_id, election_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "e2e-vote-votedvoter-pres",
        TEST_USERS.votedVoter.userId,
        candPres1Id,
        posPresId,
        electionId,
        now,
        now,
      ],
    },
  ]);

  // Ensure votedVoter has a vote in whichever election is currently open
  const openElection = await client.execute({
    sql: "SELECT id FROM elections WHERE status = 'open' LIMIT 1",
  });
  if (openElection.rows.length > 0) {
    const activeElectionId = String(openElection.rows[0].id);
    const posRes = await client.execute({
      sql: "SELECT id FROM positions WHERE election_id = ? LIMIT 1",
      args: [activeElectionId],
    });
    if (posRes.rows.length > 0) {
      const posId = String(posRes.rows[0].id);
      const candRes = await client.execute({
        sql: "SELECT id FROM candidates WHERE position_id = ? LIMIT 1",
        args: [posId],
      });
      if (candRes.rows.length > 0) {
        const candId = String(candRes.rows[0].id);
        await client.execute({
          sql: "INSERT OR IGNORE INTO votes (id, user_id, candidate_id, position_id, election_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            "e2e-votedvoter-vote-dyn",
            TEST_USERS.votedVoter.userId,
            candId,
            posId,
            activeElectionId,
            now,
            now,
          ],
        });
      }
    }
  }

  // Ensure fresh voter has no votes left over from previous test runs
  await resetVoterVotes();
}

export async function resetVoterVotes() {
  const client = createTestDatabaseClient();
  await client.execute({
    sql: "DELETE FROM votes WHERE user_id = ?",
    args: [TEST_USERS.voter.userId],
  });
}

export async function seedDraftCandidate() {
  const client = createTestDatabaseClient();
  const now = Math.floor(Date.now() / 1000);

  await client.batch([
    {
      sql: `INSERT OR IGNORE INTO elections (id, name, description, status, created_at, updated_at)
            VALUES (?, ?, ?, 'draft', ?, ?)`,
      args: [
        DRAFT_CANDIDATE.electionId,
        "E2E Draft Candidate Election",
        "Draft election used for candidate image E2E coverage",
        now,
        now,
      ],
    },
    {
      sql: `INSERT OR IGNORE INTO positions (id, election_id, name, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [DRAFT_CANDIDATE.positionId, DRAFT_CANDIDATE.electionId, "President", 1, now, now],
    },
    {
      sql: `INSERT OR IGNORE INTO candidates
            (id, full_name, account_id, position_id, manifesto, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      args: [
        DRAFT_CANDIDATE.candidateId,
        "E2E Image Candidate",
        TEST_USERS.admin.accountId,
        DRAFT_CANDIDATE.positionId,
        "Candidate image storage coverage",
        now,
        now,
      ],
    },
    {
      sql: "UPDATE elections SET status = 'draft', updated_at = ? WHERE id = ?",
      args: [now, DRAFT_CANDIDATE.electionId],
    },
    {
      sql: "UPDATE candidates SET is_active = 1, image_url = NULL, updated_at = ? WHERE id = ?",
      args: [now, DRAFT_CANDIDATE.candidateId],
    },
  ]);
}
