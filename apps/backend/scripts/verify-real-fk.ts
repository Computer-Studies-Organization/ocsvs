/**
 * Script 5: end-to-end FK enforcement on the REAL Turso schema.
 *
 * Exercises the actual elections/positions/candidates/votes tables that
 * migration 0001 just created. For each FK declared in schema.ts, we:
 *   1. Try to insert an orphan (should be rejected if FK enforced).
 *   2. If a parent exists, insert a child, then delete the parent
 *      (observes ON DELETE behaviour — CASCADE / NO ACTION / RESTRICT).
 *
 * Creates real rows on Turso; cleans up at the end. If the script crashes
 * mid-way, leftover rows are tagged with IDs starting `fk-probe-` and can
 * be deleted manually.
 *
 * Run: pnpm exec tsx scripts/verify-real-fk.ts
 */

import { createClient } from "@libsql/client";
import "dotenv/config";

type Row = Record<string, unknown>;
const NOW = Math.floor(Date.now() / 1000);
const P = "fk-probe"; // prefix for all probe IDs

async function main() {
  console.log("== Script 5: end-to-end FK enforcement on real Turso schema ==");
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error("TURSO_DATABASE_URL required");
    process.exit(1);
  }
  console.log(`URL: ${url}\n`);

  const client = createClient({ url, authToken: token || undefined });

  const fk = await client.execute("PRAGMA foreign_keys");
  console.log(`PRAGMA foreign_keys = ${(fk.rows[0] as Row).foreign_keys}\n`);

  const created: string[] = [];
  const record = (table: string, id: string) => created.push(`${table}:${id}`);

  async function tryExpect(label: string, fn: () => Promise<unknown>, shouldFail: boolean) {
    try {
      await fn();
      if (shouldFail) console.log(`  ❌ ${label} — succeeded, expected rejection`);
      else console.log(`  ✅ ${label}`);
      return { ok: !shouldFail };
    } catch (e) {
      if (shouldFail)
        console.log(`  ✅ ${label} — rejected: ${(e as Error).message.split(":")[0]}`);
      else console.log(`  ❌ ${label} — FAILED unexpectedly: ${(e as Error).message}`);
      return { ok: shouldFail, err: (e as Error).message };
    }
  }

  // ----- FK #1: positions.election_id → elections.id (ON DELETE CASCADE in schema.ts)
  console.log("FK #1: positions.election_id → elections.id (declared ON DELETE CASCADE)");
  await tryExpect(
    "orphan position (election_id = ghost) rejected",
    () =>
      client.execute({
        sql: `INSERT INTO positions(id, election_id, name, display_order, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)`,
        args: [`${P}-pos-orphan`, "ghost-election", "President", NOW, NOW],
      }),
    true,
  );
  // Now create real election + position, then delete parent → child should cascade
  await client.execute({
    sql: `INSERT INTO elections(id, name, status, created_at, updated_at) VALUES (?, 'Probe', 'draft', ?, ?)`,
    args: [`${P}-e1`, NOW, NOW],
  });
  record("elections", `${P}-e1`);
  await client.execute({
    sql: `INSERT INTO positions(id, election_id, name, display_order, created_at, updated_at) VALUES (?, ?, 'Prez', 0, ?, ?)`,
    args: [`${P}-p1`, `${P}-e1`, NOW, NOW],
  });
  record("positions", `${P}-p1`);
  await client.execute(`DELETE FROM elections WHERE id = '${P}-e1'`);
  const remainPos = await client.execute(
    `SELECT count(*) AS n FROM positions WHERE id = '${P}-p1'`,
  );
  const n1 = Number((remainPos.rows[0] as Row).n);
  console.log(
    `  ${n1 === 0 ? "✅" : "❌"} cascade: ${n1} position(s) remain after parent delete (expected 0)`,
  );

  // ----- FK #2: candidates.position_id → positions.id (declared ON DELETE RESTRICT)
  console.log("\nFK #2: candidates.position_id → positions.id (declared ON DELETE RESTRICT)");
  await tryExpect(
    "orphan candidate (position_id = ghost) rejected",
    () =>
      client.execute({
        sql: `INSERT INTO candidates(id, full_name, account_id, position_id, manifesto, is_active, created_at, updated_at) VALUES (?, 'Alice', 'ghost-account', 'ghost-position', 'x', 1, ?, ?)`,
        args: [`${P}-cand-orphan`, NOW, NOW],
      }),
    true,
  );
  // candidates.account_id → accounts.id — also test orphan account
  await tryExpect(
    "orphan candidate (account_id = ghost) rejected",
    () =>
      client.execute({
        sql: `INSERT INTO candidates(id, full_name, account_id, position_id, manifesto, is_active, created_at, updated_at) VALUES (?, 'Alice', 'ghost-account', 'ghost-position', 'x', 1, ?, ?)`,
        args: [`${P}-cand-orphan2`, NOW, NOW],
      }),
    true,
  );

  // ----- FK #3: votes.election_id → elections.id (declared ON DELETE RESTRICT)
  console.log("\nFK #3: votes.election_id → elections.id (declared ON DELETE RESTRICT)");
  await tryExpect(
    "orphan vote (election_id = ghost) rejected",
    () =>
      client.execute({
        sql: `INSERT INTO votes(id, user_id, candidate_id, position_id, election_id, created_at, updated_at) VALUES (?, 'ghost', 'ghost', 'ghost', 'ghost', ?, ?)`,
        args: [`${P}-vote-orphan`, NOW, NOW],
      }),
    true,
  );

  // ----- FK #4: votes.position_id → positions.id (declared ON DELETE RESTRICT)
  console.log("\nFK #4: votes.position_id → positions.id (declared ON DELETE RESTRICT)");
  // (covered by the vote-orphan test above which references ghost position_id too)

  // ----- FK #5: unique index votes_user_position_election_unique_idx
  console.log("\nUnique idx: votes_user_position_election_unique_idx");
  // Build a full valid row so we can test duplicate rejection
  await client.execute({
    sql: `INSERT INTO elections(id, name, status, created_at, updated_at) VALUES (?, 'Probe2', 'draft', ?, ?)`,
    args: [`${P}-e2`, NOW, NOW],
  });
  record("elections", `${P}-e2`);
  // Need an account first (candidates FK to accounts)
  await client.execute({
    sql: `INSERT INTO accounts(id, username, password_hash, role, created_at, updated_at, last_login) VALUES (?, 'fk-probe', 'h', 'user', ?, ?, ?)`,
    args: [`${P}-acc`, NOW, NOW, NOW],
  });
  record("accounts", `${P}-acc`);
  await client.execute({
    sql: `INSERT INTO positions(id, election_id, name, display_order, created_at, updated_at) VALUES (?, ?, 'Prez', 0, ?, ?)`,
    args: [`${P}-p2`, `${P}-e2`, NOW, NOW],
  });
  record("positions", `${P}-p2`);
  await client.execute({
    sql: `INSERT INTO candidates(id, full_name, account_id, position_id, manifesto, is_active, created_at, updated_at) VALUES (?, 'Alice', ?, ?, 'x', 1, ?, ?)`,
    args: [`${P}-cand`, `${P}-acc`, `${P}-p2`, NOW, NOW],
  });
  record("candidates", `${P}-cand`);
  // Need a user (votes FK to users)
  await client.execute({
    sql: `INSERT INTO users(id, account_id, student_id, first_name, last_name, course, year_level, created_at, updated_at) VALUES (?, ?, 'FK-PROBE-001', 'F', 'K', 'BSCS', '4th', ?, ?)`,
    args: [`${P}-user`, `${P}-acc`, NOW, NOW],
  });
  record("users", `${P}-user`);

  await client.execute({
    sql: `INSERT INTO votes(id, user_id, candidate_id, position_id, election_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [`${P}-vote1`, `${P}-user`, `${P}-cand`, `${P}-p2`, `${P}-e2`, NOW, NOW],
  });
  record("votes", `${P}-vote1`);
  await tryExpect(
    "duplicate vote (same user/position/election) rejected by unique index",
    () =>
      client.execute({
        sql: `INSERT INTO votes(id, user_id, candidate_id, position_id, election_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [`${P}-vote2`, `${P}-user`, `${P}-cand`, `${P}-p2`, `${P}-e2`, NOW, NOW],
      }),
    true,
  );

  // ----- FK #6: ON DELETE RESTRICT actually blocks delete of parent with children
  console.log("\nRESTRICT check: deleting position with votes attached should be blocked");
  await tryExpect(
    "DELETE position with dependent votes rejected",
    () => client.execute(`DELETE FROM positions WHERE id = '${P}-p2'`),
    true,
  );

  // ----- Cleanup (order matters due to FKs)
  console.log("\nCLEANUP");
  try {
    await client.execute(`DELETE FROM votes WHERE id LIKE '${P}-%'`);
    await client.execute(`DELETE FROM candidates WHERE id LIKE '${P}-%'`);
    await client.execute(`DELETE FROM positions WHERE id LIKE '${P}-%'`);
    await client.execute(`DELETE FROM elections WHERE id LIKE '${P}-%'`);
    await client.execute(`DELETE FROM users WHERE id LIKE '${P}-%'`);
    await client.execute(`DELETE FROM accounts WHERE id LIKE '${P}-%'`);
    console.log("  → all probe rows deleted");
  } catch (e) {
    console.log(`  → cleanup FAILED: ${(e as Error).message}`);
    console.log(`  → created rows: ${created.join(", ")}`);
  }

  console.log("\n== Script 5 complete ==");
}

main().catch((err) => {
  console.error("Script crashed:", err);
  process.exit(2);
});
