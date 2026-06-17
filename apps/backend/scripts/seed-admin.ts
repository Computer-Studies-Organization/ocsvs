/**
 * Seed script: creates an admin account + user record in the local database.
 *
 * Usage:
 *   pnpm seed:admin
 *
 * Uses the same PBKDF2-SHA256 password hashing as the app (Web Crypto API).
 * Safe to run multiple times - skips if the admin account already exists.
 */

import { createClient } from '@libsql/client'
import 'dotenv/config'

// --- Password hashing (mirrors src/lib/password.ts) ---

const ITERATIONS = 100_000
const KEY_LENGTH = 256
const SALT_LENGTH = 16

function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH,
  )

  return `${toBase64(salt)}$${toBase64(new Uint8Array(derivedKey))}`
}

// --- Config ---

const ADMIN = {
  accountId: crypto.randomUUID(),
  userId: crypto.randomUUID(),
  username: 'admin',
  email: 'admin@cso.dev',
  password: 'Admin123!',
  studentId: 'C24-01-00001-BSC001',
  firstName: 'Admin',
  lastName: 'User',
  course: 'BSCS',
  yearLevel: '4th Year',
}

// --- Main ---

async function main() {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) {
    console.error('TURSO_DATABASE_URL is not set. Check your .env file.')
    process.exit(1)
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  })

  // Check if admin already exists
  const existing = await client.execute({
    sql: 'SELECT id FROM accounts WHERE username = ?',
    args: [ADMIN.username],
  })

  if (existing.rows.length > 0) {
    console.log(
      `Admin account "${ADMIN.username}" already exists (id: ${existing.rows[0].id}). Skipping.`,
    )
    return
  }

  const passwordHash = await hashPassword(ADMIN.password)
  const now = Math.floor(Date.now() / 1000)

  await client.batch([
    {
      sql: `INSERT INTO accounts (id, username, email, password_hash, role, created_at, updated_at, last_login)
            VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)`,
      args: [ADMIN.accountId, ADMIN.username, ADMIN.email, passwordHash, now, now, now],
    },
    {
      sql: `INSERT INTO users (id, account_id, student_id, first_name, last_name, course, year_level, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [ADMIN.userId, ADMIN.accountId, ADMIN.studentId, ADMIN.firstName, ADMIN.lastName, ADMIN.course, ADMIN.yearLevel, now, now],
    },
  ])

  console.log('Admin account seeded successfully!')
  console.log(`  Username:   ${ADMIN.username}`)
  console.log(`  Password:   ${ADMIN.password}`)
  console.log(`  Student ID: ${ADMIN.studentId}`)
  console.log(`  Role:       admin`)
  console.log(`  Account ID: ${ADMIN.accountId}`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
