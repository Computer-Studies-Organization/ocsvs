import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { describe, expect, it, onTestFinished } from "vitest";

const migrationPath = fileURLToPath(new URL("./0016_needy_skreet.sql", import.meta.url));

async function createLegacyDatabase() {
  const directory = mkdtempSync(join(tmpdir(), "ocsvs-candidate-migration-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  onTestFinished(() => {
    client.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await client.batch([
    "PRAGMA foreign_keys=ON",
    "CREATE TABLE accounts (id TEXT PRIMARY KEY)",
    "CREATE TABLE users (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id))",
    "CREATE INDEX idx_users_account_id ON users (account_id)",
    "CREATE TABLE elections (id TEXT PRIMARY KEY)",
    "CREATE TABLE positions (id TEXT PRIMARY KEY)",
    "CREATE TABLE party_lists (id TEXT PRIMARY KEY)",
    "CREATE TABLE candidates (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, full_name TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), position_id TEXT NOT NULL REFERENCES positions(id), party_id TEXT REFERENCES party_lists(id), manifesto TEXT NOT NULL, is_active INTEGER NOT NULL, image_url TEXT)",
    "CREATE TABLE votes (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL, candidate_id TEXT NOT NULL REFERENCES candidates(id), position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE RESTRICT, election_id TEXT NOT NULL REFERENCES elections(id) ON DELETE RESTRICT)",
    "CREATE INDEX idx_candidates_position_id ON candidates (position_id)",
    "CREATE UNIQUE INDEX idx_candidates_active_party_position ON candidates (position_id, party_id) WHERE is_active = 1 AND party_id IS NOT NULL",
    "CREATE INDEX idx_votes_candidate_id ON votes (candidate_id)",
    "CREATE UNIQUE INDEX votes_user_candidate_unique_idx ON votes (user_id, candidate_id)",
    "CREATE UNIQUE INDEX votes_user_position_election_unique_idx ON votes (user_id, position_id, election_id)",
    "INSERT INTO elections (id) VALUES ('election-1')",
    "INSERT INTO positions (id) VALUES ('position-1')",
  ]);
  return client;
}

async function applyMigration(client: Client) {
  const migration = readFileSync(migrationPath, "utf8");
  const transaction = await client.transaction("write");

  try {
    for (const statement of migration
      .split("--> statement-breakpoint")
      .map((chunk) => chunk.trim())
      .filter(Boolean)) {
      await transaction.execute(statement);
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

describe("candidate user integrity migration", () => {
  it("rejects an orphan candidate before changing its table", async () => {
    const client = await createLegacyDatabase();
    await client.batch([
      "INSERT INTO accounts (id) VALUES ('orphan-account')",
      "INSERT INTO candidates VALUES (1, 1, 'candidate-1', 'Candidate', 'orphan-account', 'position-1', NULL, '', 1, NULL)",
    ]);

    await expect(applyMigration(client)).rejects.toThrow("CHECK constraint failed: valid");

    const foreignKeys = await client.execute("PRAGMA foreign_key_list(candidates)");
    expect(foreignKeys.rows.some((row) => row.table === "accounts")).toBe(true);
  });

  it("rejects duplicate users.account_id before changing its table", async () => {
    const client = await createLegacyDatabase();
    await client.batch([
      "INSERT INTO accounts (id) VALUES ('duplicate-account')",
      "INSERT INTO users (id, account_id) VALUES ('user-1', 'duplicate-account')",
      "INSERT INTO users (id, account_id) VALUES ('user-2', 'duplicate-account')",
    ]);

    await expect(applyMigration(client)).rejects.toThrow("CHECK constraint failed: valid");
  });

  it("enforces that new candidates reference an existing user account", async () => {
    const client = await createLegacyDatabase();
    await client.batch([
      "INSERT INTO accounts (id) VALUES ('account-1')",
      "INSERT INTO users (id, account_id) VALUES ('user-1', 'account-1')",
      "INSERT INTO candidates VALUES (1, 1, 'candidate-1', 'Candidate', 'account-1', 'position-1', NULL, '', 1, NULL)",
      "INSERT INTO votes VALUES (1, 1, 'vote-1', 'user-1', 'candidate-1', 'position-1', 'election-1')",
    ]);

    await applyMigration(client);

    const violations = await client.execute("PRAGMA foreign_key_check");
    expect(violations.rows).toHaveLength(0);
    const candidateForeignKeys = await client.execute("PRAGMA foreign_key_list(candidates)");
    expect(candidateForeignKeys.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "account_id", table: "users", to: "account_id" }),
      ]),
    );
    const preservedCandidate = await client.execute(
      "SELECT * FROM candidates WHERE id = 'candidate-1'",
    );
    expect(preservedCandidate.rows[0]).toMatchObject({
      created_at: 1,
      updated_at: 1,
      id: "candidate-1",
      full_name: "Candidate",
      account_id: "account-1",
      position_id: "position-1",
      party_id: null,
      manifesto: "",
      is_active: 1,
      image_url: null,
    });
    const preservedVote = await client.execute("SELECT * FROM votes WHERE id = 'vote-1'");
    expect(preservedVote.rows[0]).toMatchObject({
      created_at: 1,
      updated_at: 1,
      id: "vote-1",
      user_id: "user-1",
      candidate_id: "candidate-1",
      position_id: "position-1",
      election_id: "election-1",
    });
    const voteForeignKeys = await client.execute("PRAGMA foreign_key_list(votes)");
    expect(voteForeignKeys.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "user_id",
          table: "users",
          to: "id",
          on_delete: "SET NULL",
        }),
        expect.objectContaining({ from: "candidate_id", table: "candidates", to: "id" }),
        expect.objectContaining({ from: "position_id", table: "positions", to: "id" }),
        expect.objectContaining({ from: "election_id", table: "elections", to: "id" }),
      ]),
    );
    const voteIndexes = await client.execute("PRAGMA index_list(votes)");
    expect(voteIndexes.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "idx_votes_candidate_id", unique: 0 }),
        expect.objectContaining({ name: "votes_user_candidate_unique_idx", unique: 1 }),
        expect.objectContaining({
          name: "votes_user_position_election_unique_idx",
          unique: 1,
        }),
      ]),
    );
    const candidateIndex = await client.execute("PRAGMA index_info(idx_votes_candidate_id)");
    expect(candidateIndex.rows.map((row) => row.name)).toEqual(["candidate_id"]);
    const userCandidateIndex = await client.execute(
      "PRAGMA index_info(votes_user_candidate_unique_idx)",
    );
    expect(userCandidateIndex.rows.map((row) => row.name)).toEqual(["user_id", "candidate_id"]);
    const userPositionElectionIndex = await client.execute(
      "PRAGMA index_info(votes_user_position_election_unique_idx)",
    );
    expect(userPositionElectionIndex.rows.map((row) => row.name)).toEqual([
      "user_id",
      "position_id",
      "election_id",
    ]);

    await expect(
      client.execute(
        "INSERT INTO candidates VALUES (1, 1, 'candidate-2', 'Orphan', 'missing-account', 'position-1', NULL, '', 1, NULL)",
      ),
    ).rejects.toThrow();
  });
});
