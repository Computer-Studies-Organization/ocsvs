import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createClient } from "@libsql/client";
import { afterEach, expect, it } from "vitest";
import { computeVoterHash } from "../src/lib/ballot-caster";

const execFileAsync = promisify(execFile);
const testDirs: string[] = [];

afterEach(() => {
  for (const dir of testDirs.splice(0)) rmSync(dir, { recursive: true });
});

it("anonymizes a linked legacy ballot without changing its tally and is idempotent", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ocsvs-anonymize-votes-"));
  testDirs.push(dir);
  const databaseUrl = `file:${join(dir, "votes.db")}`;
  const hmacSecret = "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==";
  const client = createClient({ url: databaseUrl });

  await client.batch([
    "CREATE TABLE users (id TEXT PRIMARY KEY, student_id TEXT NOT NULL)",
    "CREATE TABLE votes (id TEXT PRIMARY KEY, user_id TEXT, candidate_id TEXT NOT NULL, election_id TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    "CREATE TABLE ballot_snapshots (id TEXT PRIMARY KEY, election_id TEXT NOT NULL, created_at INTEGER NOT NULL)",
    "CREATE TABLE voter_election_participation (id TEXT PRIMARY KEY, election_id TEXT NOT NULL, voter_hash TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))",
    "CREATE UNIQUE INDEX idx_voter_election_participation_unique ON voter_election_participation (election_id, voter_hash)",
    {
      sql: "INSERT INTO users (id, student_id) VALUES (?, ?)",
      args: ["user-1", "2026-0001"],
    },
    {
      sql: "INSERT INTO votes (id, user_id, candidate_id, election_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: ["vote-1", "user-1", "candidate-1", "election-1", 123, 456],
    },
    {
      sql: "INSERT INTO ballot_snapshots (id, election_id, created_at) VALUES (?, ?, ?)",
      args: ["snapshot-1", "election-1", 789],
    },
    {
      sql: "INSERT INTO voter_election_participation (id, election_id, voter_hash, created_at) VALUES (?, ?, ?, ?)",
      args: ["existing-participation", "election-0", "existing-hash", 123],
    },
  ]);
  const tallyBefore = await client.execute({
    sql: "SELECT count(*) AS count FROM votes WHERE candidate_id = ?",
    args: ["candidate-1"],
  });
  await client.close();

  const run = () =>
    execFileAsync(
      process.execPath,
      ["--import", "tsx", resolve("scripts/anonymize-votes.ts"), "--apply"],
      {
        env: { ...process.env, TURSO_DATABASE_URL: databaseUrl, HMAC_SECRET: hmacSecret },
      },
    );

  await run();

  const verificationClient = createClient({ url: databaseUrl });
  const votes = await verificationClient.execute("SELECT user_id, candidate_id FROM votes");
  const participation = await verificationClient.execute(
    "SELECT election_id, voter_hash, created_at FROM voter_election_participation ORDER BY election_id",
  );
  const voteTimestamps = await verificationClient.execute(
    "SELECT created_at, updated_at FROM votes",
  );
  const snapshotTimestamps = await verificationClient.execute(
    "SELECT created_at FROM ballot_snapshots",
  );
  const tallyAfter = await verificationClient.execute({
    sql: "SELECT count(*) AS count FROM votes WHERE candidate_id = ?",
    args: ["candidate-1"],
  });

  expect(votes.rows).toEqual([{ user_id: null, candidate_id: "candidate-1" }]);
  expect(voteTimestamps.rows).toEqual([{ created_at: 0, updated_at: 0 }]);
  expect(snapshotTimestamps.rows).toEqual([{ created_at: 0 }]);
  expect(participation.rows).toEqual([
    { election_id: "election-0", voter_hash: "existing-hash", created_at: 0 },
    {
      election_id: "election-1",
      voter_hash: await computeVoterHash("election-1", "2026-0001", hmacSecret),
      created_at: 0,
    },
  ]);
  expect(tallyAfter.rows[0].count).toBe(tallyBefore.rows[0].count);
  await verificationClient.close();

  await run();

  const idempotenceClient = createClient({ url: databaseUrl });
  const participationCount = await idempotenceClient.execute(
    "SELECT count(*) AS count FROM voter_election_participation",
  );
  expect(participationCount.rows[0].count).toBe(2);
  await idempotenceClient.close();
}, 15_000);
