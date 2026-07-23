import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;

function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH
  );

  return `${toBase64(salt)}$${toBase64(new Uint8Array(derivedKey))}`;
}

export const TEST_USERS = {
  admin: {
    accountId: 'e2e-admin-account-id',
    userId: 'e2e-admin-user-id',
    username: 'e2e_admin',
    email: 'e2e_admin@cso.dev',
    password: 'Admin123!',
    studentId: 'C24-01-99999-BSC001',
    firstName: 'E2EAdmin',
    lastName: 'User',
    course: 'BSCS',
    yearLevel: '4th Year',
    role: 'super_admin',
  },
  voter: {
    accountId: 'e2e-voter-account-id',
    userId: 'e2e-voter-user-id',
    username: 'e2e_voter',
    email: 'e2e_voter@cso.dev',
    password: 'Voter123!',
    studentId: 'C25-01-99999-BSC001',
    firstName: 'E2EVoter',
    lastName: 'User',
    course: 'BSCS',
    yearLevel: '1st Year',
    role: 'user',
  },
};

export async function seedTestUsers() {
  const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
  const client = createClient({
    url: dbUrl,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  const now = Math.floor(Date.now() / 1000);

  for (const userKey of ['admin', 'voter'] as const) {
    const u = TEST_USERS[userKey];
    const existing = await client.execute({
      sql: 'SELECT id FROM accounts WHERE username = ? OR id = ?',
      args: [u.username, u.accountId],
    });

    if (existing.rows.length === 0) {
      const passwordHash = await hashPassword(u.password);
      await client.batch([
        {
          sql: `INSERT INTO accounts (id, username, email, password_hash, role, created_at, updated_at, last_login)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [u.accountId, u.username, u.email, passwordHash, u.role, now, now, now],
        },
        {
          sql: `INSERT INTO users (id, account_id, student_id, first_name, last_name, course, year_level, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            u.userId,
            u.accountId,
            u.studentId,
            u.firstName,
            u.lastName,
            u.course,
            u.yearLevel,
            now,
            now,
          ],
        },
      ]);
    }
  }
}
