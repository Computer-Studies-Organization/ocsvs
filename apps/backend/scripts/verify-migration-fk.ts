/**
 * Script 2: migration-0001 behaviour under FK=ON vs FK=OFF.
 *
 * Context from Script 1: libsql defaults `foreign_keys` to 1 on local files
 * (surprising — vanilla SQLite defaults to 0). So the claim that our
 * migration "only works because FKs are off" needs to be re-tested: it may
 * actually have succeeded under FK=ON on an empty table, or libsql may be
 * more permissive than upstream SQLite about ALTER TABLE ADD COLUMN.
 *
 * Claims under test:
 *   M1. `ALTER TABLE … ADD col text NOT NULL REFERENCES parent(id)`
 *       succeeds against an empty table when FKs are ON (libsql-specific?).
 *   M2. The same statement fails on a non-empty table when FKs are ON.
 *   M3. With FKs ON and the column added, inserting a row whose FK points
 *       at a non-existent parent is rejected.
 *   M4. The full migration 0001 SQL (read from disk) applies cleanly to an
 *       empty database with FKs at their libsql default.
 *   M5. The same migration fails on a database that already has votes or
 *       candidates (matching the header's "destructive, wipe first" story).
 *
 * Run: pnpm exec tsx scripts/verify-migration-fk.ts
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@libsql/client'

const URL = 'file::memory:'

type Row = Record<string, unknown>

async function fk(client: ReturnType<typeof createClient>) {
  const r = await client.execute('PRAGMA foreign_keys')
  return (r.rows[0] as Row).foreign_keys
}

async function tryStep(label: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    console.log(`  ✅ ${label}`)
    return { ok: true }
  }
  catch (e) {
    console.log(`  ❌ ${label}: ${(e as Error).message}`)
    return { ok: false, err: (e as Error).message }
  }
}

async function setupLegacyTables(client: ReturnType<typeof createClient>, seed: boolean) {
  // Recreate the legacy (pre-0001) shape that the migration is expected to find.
  await client.execute(`CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    email TEXT,
    created_at INTEGER, updated_at INTEGER, last_login INTEGER, deleted_at INTEGER
  )`)
  await client.execute(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    student_id TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL, last_name TEXT NOT NULL,
    year_level TEXT NOT NULL, course TEXT NOT NULL,
    has_voted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER, updated_at INTEGER
  )`)
  await client.execute(`CREATE TABLE candidates (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    position TEXT NOT NULL,
    manifesto TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER, updated_at INTEGER
  )`)
  await client.execute(`CREATE TABLE votes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    candidate_id TEXT NOT NULL REFERENCES candidates(id),
    position TEXT NOT NULL,
    created_at INTEGER, updated_at INTEGER
  )`)
  await client.execute(`CREATE UNIQUE INDEX votes_user_candidate_unique_idx ON votes(user_id, candidate_id)`)
  await client.execute(`CREATE UNIQUE INDEX votes_user_position_unique_idx ON votes(user_id, position)`)

  if (seed) {
    const now = Math.floor(Date.now() / 1000)
    const aid = 'acc-1'
    const uid = 'usr-1'
    const cid = 'cand-1'
    const vid = 'vote-1'
    await client.execute({ sql: `INSERT INTO accounts(id, username, password_hash, role, created_at, updated_at, last_login) VALUES (?, 'admin', 'hash', 'admin', ?, ?, ?)`, args: [aid, now, now, now] })
    await client.execute({ sql: `INSERT INTO users(id, account_id, student_id, first_name, last_name, course, year_level, created_at, updated_at) VALUES (?, ?, 'S001', 'A', 'B', 'BSCS', '4th', ?, ?)`, args: [uid, aid, now, now] })
    await client.execute({ sql: `INSERT INTO candidates(id, full_name, account_id, position, manifesto, created_at, updated_at) VALUES (?, 'Alice', ?, 'President', 'hi', ?, ?)`, args: [cid, aid, now, now] })
    await client.execute({ sql: `INSERT INTO votes(id, user_id, candidate_id, position, created_at, updated_at) VALUES (?, ?, ?, 'President', ?, ?)`, args: [vid, uid, cid, now, now] })
  }
}

async function main() {
  console.log('== Script 2: migration-0001 under FK=ON vs FK=OFF ==')
  console.log(`URL: ${URL}\n`)

  // ---------------------------------------------------------------- M1 + M2
  console.log('--- M1 / M2: ALTER TABLE ADD NOT NULL REFERENCES on empty vs non-empty table ---')
  {
    const client = createClient({ url: URL })
    console.log(`  FK default: ${await fk(client)}`)

    await client.execute(`CREATE TABLE parent (id TEXT PRIMARY KEY)`)
    await client.execute(`CREATE TABLE child  (id TEXT PRIMARY KEY)`)

    // M1: empty child
    const m1 = await tryStep(
      'M1: ALTER child ADD parent_id TEXT NOT NULL REFERENCES parent(id) — empty table',
      () => client.execute(`ALTER TABLE child ADD parent_id TEXT NOT NULL REFERENCES parent(id)`),
    )

    // M2: non-empty child (add a row with no parent to reference)
    const seedExisting = await tryStep(
      'M2-prep: INSERT child(id) VALUES (c1) into now-NOT-NULL-parented table',
      () => client.execute(`INSERT INTO child(id) VALUES ('c1')`),
    )
    const m2 = await tryStep(
      'M2: same ALTER — non-empty table',
      () => client.execute(`ALTER TABLE child ADD parent_id TEXT NOT NULL REFERENCES parent(id)`),
    )
    if (!seedExisting.ok) {
      console.log(`      ↳ existing-row insert failed (NOT NULL col already has no default on empty row? unusual)`)
    }
    if (!m2.ok) {
      console.log(`      ↳ expected on SQLite: ALTER rejected because existing rows lack a default for the NOT NULL col`)
    }
  }

  // ---------------------------------------------------------------- M3
  console.log('\n--- M3: FK enforcement after ALTER (when it succeeded) ---')
  {
    const client = createClient({ url: URL })
    await client.execute(`CREATE TABLE parent (id TEXT PRIMARY KEY)`)
    await client.execute(`CREATE TABLE child  (id TEXT PRIMARY KEY)`)
    await client.execute(`ALTER TABLE child ADD parent_id TEXT NOT NULL REFERENCES parent(id)`)
    const m3 = await tryStep(
      'M3: INSERT child referencing non-existent parent is rejected',
      () => client.execute(`INSERT INTO child(id, parent_id) VALUES ('c1', 'ghost')`),
    )
    if (m3.ok)
      console.log('      ↳ UNEXPECTED: FK was not enforced after ALTER')
  }

  // ---------------------------------------------------------------- M4
  console.log('\n--- M4: full migration 0001 against empty legacy DB (default FK=1) ---')
  const sqlPath = resolve(process.cwd(), 'src/database/migrations/0001_sharp_lord_tyger.sql')
  const migrationSql = readFileSync(sqlPath, 'utf8')
  // Split on the Drizzle statement breakpoint marker, then strip leading `--`
  // comment lines from each chunk (the migration header lives inside the
  // first chunk). Keep the chunk if any non-comment SQL remains.
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map(chunk =>
      chunk
        .split('\n')
        .filter(line => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(s => s.length > 0)

  console.log(`  migration has ${statements.length} statements`)
  {
    const client = createClient({ url: URL })
    console.log(`  FK default: ${await fk(client)}`)
    await setupLegacyTables(client, false /* no seed */)

    let passCount = 0
    let failCount = 0
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      const firstLine = stmt.split('\n')[0].slice(0, 80)
      try {
        await client.execute(stmt)
        passCount++
      }
      catch (e) {
        failCount++
        console.log(`  ❌ stmt #${i + 1} "${firstLine}"`)
        console.log(`      ${(e as Error).message}`)
      }
    }
    console.log(`  → M4 result: ${passCount}/${statements.length} statements applied${failCount === 0 ? ' — PASS' : ' — FAIL'}`)

    // Post-migration sanity: does FK enforcement actually work on the new schema?
    const seedElection = await tryStep(
      'M4-post: seed election e1 + position p1',
      async () => {
        await client.execute(`INSERT INTO elections(id, name, status) VALUES ('e1', 'Test', 'draft')`)
        await client.execute(`INSERT INTO positions(id, election_id, name) VALUES ('p1', 'e1', 'Prez')`)
      },
    )
    if (seedElection.ok) {
      const orphanPos = await tryStep(
        'M4 sanity: position referencing non-existent election rejected',
        () => client.execute(`INSERT INTO positions(id, election_id, name) VALUES ('p-bad', 'ghost', 'X')`),
      )
      if (orphanPos.ok)
        console.log('      ↳ UNEXPECTED: FK not enforced on positions.election_id')
    }
    else {
      console.log('      ↳ post-migration seed failed; FK sanity check skipped')
    }
  }

  // ---------------------------------------------------------------- M5
  console.log('\n--- M5: full migration 0001 against legacy DB WITH data (header said it wipes) ---')
  {
    const client = createClient({ url: URL })
    console.log(`  FK default: ${await fk(client)}`)
    await setupLegacyTables(client, true /* seed votes + candidates */)

    const rowsBefore = await client.execute(`SELECT count(*) AS n FROM votes`)
    console.log(`  votes before: ${(rowsBefore.rows[0] as Row).n}`)

    let failAt = -1
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.execute(statements[i])
      }
      catch (e) {
        failAt = i + 1
        console.log(`  ❌ stmt #${i + 1}: ${(e as Error).message}`)
        break
      }
    }
    if (failAt === -1) {
      console.log('  → M5 result: all statements applied (migration is NOT destructive on populated DB — contradicts header)')
    }
    else {
      console.log(`  → M5 result: migration stops at stmt #${failAt} when data is present (matches header: wipe first)`)
    }
  }

  console.log('\n== Script 2 complete ==')
}

main().catch((err) => {
  console.error('Script crashed:', err)
  process.exit(2)
})
