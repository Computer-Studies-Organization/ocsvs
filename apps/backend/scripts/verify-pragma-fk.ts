/**
 * Script 1: PRAGMA support + persistence verification.
 *
 * Goal: verify that @libsql/client's SQLite engine (which is libsql, a SQLite
 * fork) honours `PRAGMA foreign_keys = ON` and that the setting persists
 * across multiple `execute()` calls on the same Client instance.
 *
 * Scope: isolated local SQLite file (file::memory: for speed, no disk writes).
 *
 * Claims under test:
 *   C1. `PRAGMA foreign_keys` returns 0 by default.
 *   C2. After `PRAGMA foreign_keys = ON`, the value returned is 1.
 *   C3. A subsequent `execute()` on the same Client still observes FK = 1
 *       (the pragma persists across calls).
 *   C4. When FKs are ON, an INSERT that violates a REFERENCES clause fails
 *       (defence-in-depth check — proves the pragma actually enforces, not
 *       just reports).
 *
 * Run: pnpm exec tsx scripts/verify-pragma-fk.ts
 */

import { createClient } from "@libsql/client";

const URL = "file::memory:";

type Row = Record<string, unknown>;

async function pragma(client: ReturnType<typeof createClient>, label: string) {
  const res = await client.execute("PRAGMA foreign_keys");
  const row = res.rows[0] as Row | undefined;
  const value = row?.foreign_keys ?? "<missing>";
  console.log(`  [${label}] PRAGMA foreign_keys = ${value}`);
  return value;
}

async function main() {
  console.log("== Script 1: PRAGMA foreign_keys support & persistence ==");
  console.log(`URL: ${URL}\n`);

  const client = createClient({ url: URL });

  // --- Setup: parent + child with REFERENCES ---
  console.log(
    "SETUP: create parent(id) and child(id, parent_id REFERENCES parent(id) ON DELETE CASCADE)",
  );
  await client.execute(`CREATE TABLE parent (id TEXT PRIMARY KEY)`);
  await client.execute(`CREATE TABLE child (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL REFERENCES parent(id) ON DELETE CASCADE
  )`);
  await client.execute(`INSERT INTO parent(id) VALUES ('p1')`);

  // --- C1: default state ---
  console.log("\nCLAIM C1: PRAGMA foreign_keys defaults to 0");
  const c1 = await pragma(client, "C1-default");
  console.log(`  → ${c1 === 0 || c1 === 0n ? "PASS" : "FAIL (expected 0)"}`);

  // --- Prove FK is actually off: an orphan insert should succeed ---
  console.log("\n  Sanity: INSERT orphan child with FK=OFF...");
  try {
    await client.execute(`INSERT INTO child(id, parent_id) VALUES ('c-orphan', 'does-not-exist')`);
    console.log("  → orphan INSERT succeeded (FK truly off)");
  } catch (e) {
    console.log(`  → orphan INSERT FAILED unexpectedly: ${(e as Error).message}`);
  }

  // --- C2: enable the pragma ---
  console.log("\nCLAIM C2: PRAGMA foreign_keys = ON flips the value to 1");
  await client.execute("PRAGMA foreign_keys = ON");
  const c2 = await pragma(client, "C2-after-on");
  console.log(`  → ${c2 === 1 || c2 === 1n ? "PASS" : "FAIL (expected 1)"}`);

  // --- C3: persistence across execute calls ---
  console.log("\nCLAIM C3: the pragma persists across separate execute() calls");
  const c3 = await pragma(client, "C3-subsequent-call");
  console.log(`  → ${c3 === 1 || c3 === 1n ? "PASS" : "FAIL (expected 1)"}`);

  // --- C4: actual enforcement kicks in ---
  console.log("\nCLAIM C4: with FK=ON, INSERT violating REFERENCES throws");
  let c4 = false;
  try {
    await client.execute(`INSERT INTO child(id, parent_id) VALUES ('c-bad', 'does-not-exist')`);
    console.log("  → orphan INSERT succeeded (FK NOT enforced!) — FAIL");
  } catch (e) {
    c4 = true;
    console.log(`  → orphan INSERT rejected: ${(e as Error).message} — PASS`);
  }

  // --- C4 bonus: ON DELETE CASCADE fires when parent is deleted ---
  console.log("\n  Bonus: delete parent, check child is cascaded (ON DELETE CASCADE)");
  await client.execute(`DELETE FROM child WHERE id = 'c-orphan'`); // clean the earlier orphan
  await client.execute(`INSERT INTO child(id, parent_id) VALUES ('c1', 'p1')`);
  await client.execute(`DELETE FROM parent WHERE id = 'p1'`);
  const remaining = await client.execute(`SELECT count(*) AS n FROM child`);
  const n = (remaining.rows[0] as Row).n;
  console.log(
    `  → children remaining after parent delete: ${n} ${n === 0 || n === 0n ? "(CASCADE fired — PASS)" : "(CASCADE did NOT fire — FAIL)"}`,
  );

  console.log("\n== Summary ==");
  const results = [
    ["C1 default = 0", c1 === 0 || c1 === 0n],
    ["C2 flips to 1", c2 === 1 || c2 === 1n],
    ["C3 persists across calls", c3 === 1 || c3 === 1n],
    ["C4 enforcement active", c4],
  ];
  for (const [label, ok] of results) console.log(`  ${ok ? "✅" : "❌"} ${label}`);

  const allPass = results.every(([, ok]) => ok);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Script crashed:", err);
  process.exit(2);
});
