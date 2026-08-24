import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(new URL("./0017_vote_window_guard.sql", import.meta.url));

async function applyMigration(client: Client) {
  const migration = readFileSync(migrationPath, "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    await client.execute(statement);
  }
}

function ballotBatch(electionId: string, suffix: string) {
  return [
    {
      sql: "INSERT INTO votes (id, candidate_id, position_id, election_id) VALUES (?, ?, ?, ?)",
      args: [`vote-${suffix}`, `candidate-${electionId}`, `position-${electionId}`, electionId],
    },
    {
      sql: "INSERT INTO ballot_snapshots (id, election_id) VALUES (?, ?)",
      args: [`snapshot-${suffix}`, electionId],
    },
    {
      sql: "INSERT INTO voter_election_participation (id, election_id) VALUES (?, ?)",
      args: [`participation-${suffix}`, electionId],
    },
  ];
}

describe("vote window guard migration", () => {
  it("allows current ballots and atomically rejects closed or expired ballots", async () => {
    const client = createClient({ url: "file::memory:" });
    const now = Math.floor(Date.now() / 1000);

    try {
      await client.batch([
        "PRAGMA foreign_keys=ON",
        "CREATE TABLE elections (id TEXT PRIMARY KEY, status TEXT NOT NULL, opens_at INTEGER, closes_at INTEGER)",
        "CREATE TABLE positions (id TEXT PRIMARY KEY, election_id TEXT NOT NULL REFERENCES elections(id))",
        "CREATE TABLE candidates (id TEXT PRIMARY KEY, position_id TEXT NOT NULL REFERENCES positions(id))",
        "CREATE TABLE votes (id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL REFERENCES candidates(id), position_id TEXT NOT NULL REFERENCES positions(id), election_id TEXT NOT NULL REFERENCES elections(id))",
        "CREATE TABLE ballot_snapshots (id TEXT PRIMARY KEY, election_id TEXT NOT NULL REFERENCES elections(id))",
        "CREATE TABLE voter_election_participation (id TEXT PRIMARY KEY, election_id TEXT NOT NULL REFERENCES elections(id))",
      ]);
      await client.batch([
        {
          sql: "INSERT INTO elections VALUES (?, ?, ?, ?)",
          args: ["current", "open", now - 60, now + 60],
        },
        {
          sql: "INSERT INTO elections VALUES (?, ?, ?, ?)",
          args: ["closed", "closed", now - 60, now + 60],
        },
        {
          sql: "INSERT INTO elections VALUES (?, ?, ?, ?)",
          args: ["expired", "open", now - 60, now - 1],
        },
        ...["current", "closed", "expired"].flatMap((electionId) => [
          {
            sql: "INSERT INTO positions VALUES (?, ?)",
            args: [`position-${electionId}`, electionId],
          },
          {
            sql: "INSERT INTO candidates VALUES (?, ?)",
            args: [`candidate-${electionId}`, `position-${electionId}`],
          },
        ]),
      ]);
      await applyMigration(client);

      await client.batch(ballotBatch("current", "current"));
      await expect(client.batch(ballotBatch("closed", "closed"))).rejects.toThrow(
        "ELECTION_NOT_OPEN",
      );
      await expect(client.batch(ballotBatch("expired", "expired"))).rejects.toThrow(
        "ELECTION_NOT_OPEN",
      );

      await expect(client.execute("SELECT count(*) AS count FROM votes")).resolves.toMatchObject({
        rows: [{ count: 1 }],
      });
      await expect(
        client.execute("SELECT count(*) AS count FROM ballot_snapshots"),
      ).resolves.toMatchObject({ rows: [{ count: 1 }] });
      await expect(
        client.execute("SELECT count(*) AS count FROM voter_election_participation"),
      ).resolves.toMatchObject({ rows: [{ count: 1 }] });
    } finally {
      client.close();
    }
  });
});
