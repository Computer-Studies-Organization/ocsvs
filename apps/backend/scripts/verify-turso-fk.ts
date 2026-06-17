/**
 * Script 3: Turso endpoint verification.
 *
 * Goal: replicate the key Script-1/2 claims against the ACTUAL Turso database
 * configured in .env. libsql's local driver defaults `foreign_keys` to 1;
 * the remote/HTTP protocol may behave differently (session scoping, proxying,
 * unsupported-statement errors have all been reported anecdotally).
 *
 * Strategy — non-destructive first, then opt-in writes:
 *   T1. Read PRAGMA foreign_keys from Turso. Record the value.
 *   T2. Round-trip a PRAGMA foreign_keys = ON and re-read. Observe whether
 *       the value changes (proves the remote accepts the write).
 *   T3. Create a temporary `pragma_probe_<ts>` table pair (parent/child with
 *       ON DELETE CASCADE), exercise FK enforcement, then drop the tables.
 *       Confirms that whatever the PRAGMA reports, the runtime actually
 *       enforces (or does not enforce) REFERENCES clauses.
 *
 * This script creates + drops its OWN tables so it doesn't touch the
 * elections/votes schema. If anything crashes mid-way, the probe tables
 * are left behind — names are `pragma_probe_<ts>_parent` / `_child` and
 * can be dropped manually.
 *
 * Run: pnpm exec tsx scripts/verify-turso-fk.ts
 * Requires: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN set in .env (dotenv loaded).
 */

import { createClient } from '@libsql/client'
import 'dotenv/config'

type Row = Record<string, unknown>
const TS = Date.now()
const PARENT = `pragma_probe_${TS}_parent`
const CHILD = `pragma_probe_${TS}_child`

async function main() {
  console.log('== Script 3: Turso endpoint PRAGMA + FK enforcement ==')

  const url = process.env.TURSO_DATABASE_URL
  const token = process.env.TURSO_AUTH_TOKEN
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set. Check apps/backend/.env')
    process.exit(1)
  }
  console.log(`URL: ${url} (remote: ${!url.startsWith('file:')})`)
  console.log(`probe tables: ${PARENT}, ${CHILD}\n`)

  const client = createClient({ url, authToken: token || undefined })

  // ---------- T1: read default ----------
  console.log('T1: read PRAGMA foreign_keys')
  let t1: unknown = '<error>'
  try {
    const r = await client.execute('PRAGMA foreign_keys')
    t1 = (r.rows[0] as Row | undefined)?.foreign_keys ?? '<missing>'
    console.log(`  → PRAGMA foreign_keys = ${String(t1)}`)
  }
  catch (e) {
    console.log(`  → PRAGMA read FAILED: ${(e as Error).message}`)
  }

  // ---------- T2: flip to ON ----------
  console.log('\nT2: write PRAGMA foreign_keys = ON and re-read')
  let t2: unknown = '<error>'
  try {
    await client.execute('PRAGMA foreign_keys = ON')
    const r = await client.execute('PRAGMA foreign_keys')
    t2 = (r.rows[0] as Row | undefined)?.foreign_keys ?? '<missing>'
    console.log(`  → PRAGMA foreign_keys = ${String(t2)}`)
  }
  catch (e) {
    console.log(`  → PRAGMA write FAILED: ${(e as Error).message}`)
  }

  // ---------- T3: exercise enforcement ----------
  console.log('\nT3: create parent/child pair and test enforcement')
  let t3Created = false
  let t3OrphanInsert = 'not-tested'
  let t3Cascade = 'not-tested'

  try {
    await client.execute(`CREATE TABLE ${PARENT} (id TEXT PRIMARY KEY)`)
    await client.execute(`CREATE TABLE ${CHILD} (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL REFERENCES ${PARENT}(id) ON DELETE CASCADE
    )`)
    await client.execute(`INSERT INTO ${PARENT}(id) VALUES ('p1')`)
    t3Created = true
    console.log(`  → tables created + parent p1 seeded`)
  }
  catch (e) {
    console.log(`  → setup FAILED: ${(e as Error).message}`)
  }

  if (t3Created) {
    // Orphan insert: should be rejected if FKs enforced
    try {
      await client.execute(`INSERT INTO ${CHILD}(id, parent_id) VALUES ('c-bad', 'ghost')`)
      t3OrphanInsert = 'accepted (FK OFF or not enforced)'
    }
    catch (e) {
      t3OrphanInsert = `rejected: ${(e as Error).message}`
    }
    console.log(`  → orphan INSERT: ${t3OrphanInsert}`)

    // Legit insert, then delete parent and check cascade
    try {
      await client.execute(`INSERT INTO ${CHILD}(id, parent_id) VALUES ('c1', 'p1')`)
      await client.execute(`DELETE FROM ${PARENT} WHERE id = 'p1'`)
      const r = await client.execute(`SELECT count(*) AS n FROM ${CHILD}`)
      const n = (r.rows[0] as Row).n
      t3Cascade = Number(n) === 0 ? `CASCADE fired (0 children remain)` : `CASCADE did NOT fire (${String(n)} children remain)`
    }
    catch (e) {
      t3Cascade = `error during cascade check: ${(e as Error).message}`
    }
    console.log(`  → after DELETE parent: ${t3Cascade}`)

    // Cleanup
    console.log('\nCLEANUP: drop probe tables')
    try {
      await client.execute(`DROP TABLE IF EXISTS ${CHILD}`)
      await client.execute(`DROP TABLE IF EXISTS ${PARENT}`)
      console.log('  → dropped')
    }
    catch (e) {
      console.log(`  → drop FAILED (manual cleanup needed): ${(e as Error).message}`)
    }
  }

  // ---------- Summary ----------
  console.log('\n== Summary ==')
  console.log(`  T1 default PRAGMA value   : ${String(t1)}`)
  console.log(`  T2 post-write PRAGMA value: ${String(t2)}`)
  console.log(`  T3 orphan insert          : ${t3OrphanInsert}`)
  console.log(`  T3 cascade on delete      : ${t3Cascade}`)

  const fkOn = t1 === 1 || t1 === 1n || t2 === 1 || t2 === 1n
  const enforced = t3OrphanInsert.startsWith('rejected')
  console.log(`\n  Verdict: PRAGMA reports ${fkOn ? 'ON' : 'OFF'}; runtime ${enforced ? 'DOES enforce' : 'DOES NOT enforce'} FKs`)
  console.log(`  Match? ${fkOn === enforced ? 'YES ✅' : 'NO ❌ (PRAGMA and runtime disagree — investigate)'}`)
}

main().catch((err) => {
  console.error('Script crashed:', err)
  process.exit(2)
})
