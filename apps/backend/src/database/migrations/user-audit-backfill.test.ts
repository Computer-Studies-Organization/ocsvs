import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(
  new URL("./0013_repair_user_create_audit_targets.sql", import.meta.url),
);

describe("user.create audit target migration", () => {
  it("maps historical account IDs to user IDs without touching other rows", async () => {
    const client = createClient({ url: "file::memory:" });
    await client.batch([
      "CREATE TABLE accounts (id TEXT PRIMARY KEY)",
      "CREATE TABLE users (id TEXT PRIMARY KEY, account_id TEXT NOT NULL)",
      "CREATE TABLE audit_log (id TEXT PRIMARY KEY, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL)",
      "INSERT INTO accounts (id) VALUES ('account-1')",
      "INSERT INTO users (id, account_id) VALUES ('user-1', 'account-1')",
      "INSERT INTO audit_log (id, action, target_type, target_id) VALUES ('create-old', 'user.create', 'user', 'account-1')",
      "INSERT INTO audit_log (id, action, target_type, target_id) VALUES ('create-new', 'user.create', 'user', 'user-1')",
      "INSERT INTO audit_log (id, action, target_type, target_id) VALUES ('update-old', 'user.update', 'user', 'account-1')",
      "INSERT INTO audit_log (id, action, target_type, target_id) VALUES ('create-orphan', 'user.create', 'user', 'missing-account')",
    ]);

    const migration = readFileSync(migrationPath, "utf8");
    for (const statement of migration
      .split("--> statement-breakpoint")
      .map((chunk) =>
        chunk
          .split("\n")
          .filter((line) => !line.trimStart().startsWith("--"))
          .join("\n")
          .trim(),
      )
      .filter(Boolean)) {
      await client.execute(statement);
    }

    const rows = await client.execute(
      "SELECT id, target_id AS targetId FROM audit_log ORDER BY id",
    );

    expect(rows.rows).toEqual([
      { id: "create-new", targetId: "user-1" },
      { id: "create-old", targetId: "user-1" },
      { id: "create-orphan", targetId: "missing-account" },
      { id: "update-old", targetId: "account-1" },
    ]);
  });
});
