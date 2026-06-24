/**
 * Script 4: reproduce the failure mode that Option A warned about.
 *
 * Context: migration 0001 already applied successfully. But Drizzle will
 * generate similar `ALTER TABLE ADD COLUMN` statements for future schema
 * changes. Under FK=ON (Turso default) + a populated table, does the
 * statement actually fail?
 *
 * This tells us whether table-recreation migrations are needed for
 * FUTURE work, not just for a hypothetical rewrite of 0001.
 *
 * Uses Turso endpoint with a temporary probe table so we don't touch
 * application schema.
 *
 * Run: pnpm exec tsx scripts/verify-future-migration.ts
 */

import { createClient } from "@libsql/client";
import "dotenv/config";

type Row = Record<string, unknown>;
const TS = Date.now();
const T1 = `future_probe_${TS}_p`;
const T2 = `future_probe_${TS}_c`;

async function main() {
  console.log("== Script 4: future-migration failure mode under FK=ON ==");
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    console.error("TURSO_DATABASE_URL required");
    process.exit(1);
  }
  console.log(`URL: ${url}`);
  console.log(`probe tables: ${T1}, ${T2}\n`);

  const client = createClient({ url, authToken: token || undefined });

  const fk = await client.execute("PRAGMA foreign_keys");
  console.log(`FK at start: ${(fk.rows[0] as Row).foreign_keys}\n`);

  // Setup: simulate "schema v1" with parent + child that has NO FK yet
  await client.execute(`CREATE TABLE ${T1} (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  await client.execute(`CREATE TABLE ${T2} (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
  await client.execute(`INSERT INTO ${T1}(id, name) VALUES ('p1', 'Parent 1')`);
  await client.execute(`INSERT INTO ${T2}(id, name) VALUES ('c1', 'Child 1')`); // populated!
  console.log(`seeded ${T1} (1 row) + ${T2} (1 row, no FK col yet)\n`);

  // Scenario A: ALTER TABLE ADD NOT NULL REFERENCES — what Drizzle emits
  console.log("Scenario A (Drizzle default output):");
  console.log(`  ALTER TABLE ${T2} ADD parent_id TEXT NOT NULL REFERENCES ${T1}(id)`);
  try {
    await client.execute(`ALTER TABLE ${T2} ADD parent_id TEXT NOT NULL REFERENCES ${T1}(id)`);
    console.log("  → succeeded (surprising under FK=ON + populated table)");
  } catch (e) {
    console.log(`  → FAILED: ${(e as Error).message}`);
    console.log("      ↳ This is the Option-A failure mode. Future migrations");
    console.log("        that add FK columns to populated tables will need");
    console.log("        either (a) table-recreation pattern or (b) disabling");
    console.log("        FKs for the migration statement.");
  }

  // Scenario B: ALTER TABLE ADD with DEFAULT NULL REFERENCES (FK-safe form)
  console.log("\nScenario B (FK-safe form):");
  console.log(`  ALTER TABLE ${T2} ADD parent_id_opt TEXT REFERENCES ${T1}(id)`);
  try {
    await client.execute(`ALTER TABLE ${T2} ADD parent_id_opt TEXT REFERENCES ${T1}(id)`);
    console.log("  → succeeded (expected — nullable + no NOT NULL)");
  } catch (e) {
    console.log(`  → FAILED (unexpected): ${(e as Error).message}`);
  }

  // Scenario C: disable FKs for one statement, run ALTER, re-enable
  console.log("\nScenario C (disable FKs for the ALTER, re-enable):");
  await client.execute("PRAGMA foreign_keys = OFF");
  try {
    await client.execute(`ALTER TABLE ${T2} ADD parent_id_off TEXT NOT NULL REFERENCES ${T1}(id)`);
    console.log("  → ALTER succeeded with FKs off");
  } catch (e) {
    console.log(`  → FAILED even with FKs off: ${(e as Error).message}`);
  }
  await client.execute("PRAGMA foreign_keys = ON");
  const after = await client.execute("PRAGMA foreign_keys");
  console.log(`  FKs re-enabled: ${(after.rows[0] as Row).foreign_keys}`);

  // Cleanup
  console.log("\nCLEANUP");
  await client.execute(`DROP TABLE IF EXISTS ${T2}`);
  await client.execute(`DROP TABLE IF EXISTS ${T1}`);
  console.log("  → probe tables dropped");

  console.log("\n== Takeaway ==");
  console.log("  Future Drizzle migrations that ADD a REFERENCES column to a");
  console.log("  POPULATED table will fail under Turso's default FK=ON unless:");
  console.log(
    "    (a) the migration uses table-recreation (CREATE new, copy, drop old, rename), OR",
  );
  console.log("    (b) the migration emits PRAGMA foreign_keys = OFF before the ALTER");
  console.log("        and PRAGMA foreign_keys = ON after, OR");
  console.log("    (c) the new column is nullable (DEFAULT NULL).");
  console.log("  Migration 0001 got away with (a) because the DELETEs emptied the");
  console.log("  tables first — that trick only works if you're willing to wipe.");
}

main().catch((err) => {
  console.error("Script crashed:", err);
  process.exit(2);
});
