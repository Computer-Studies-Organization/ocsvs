import { z } from '@hono/zod-openapi'
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { createSelectSchema } from 'drizzle-zod'

export const ROLES = z.enum(['user', 'admin'])

export const accounts = sqliteTable('accounts', {
  createdAt: integer('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  lastLogin: integer('last_login')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  id: text('id').primaryKey(),
  role: text('role').notNull().default('user'),
  username: text('username').notNull().unique(),
  email: text('email'),
  password_hash: text('password_hash').notNull(),
})

export const users = sqliteTable('users', {
  createdAt: integer('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  studentId: text('student_id').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  yearLevel: text('year_level').notNull(),
  course: text('course').notNull(),
  hasVoted: integer('has_voted').notNull().default(0),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`),
})

export const candidates = sqliteTable('candidates', {
  createdAt: integer('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  position: text('position').notNull(),
  manifesto: text('manifesto').notNull(),
  isActive: integer('is_active').notNull().default(1),
})

export const votes = sqliteTable('votes', {
  createdAt: integer('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  candidateId: text('candidate_id').notNull().references(() => candidates.id),
  position: text('position').notNull(),
}, table => [
  uniqueIndex('votes_user_candidate_unique_idx').on(table.userId, table.candidateId),
  uniqueIndex('votes_user_position_unique_idx').on(table.userId, table.position),
])

export const DbSelectUserSchema = createSelectSchema(users)

export const SelectAccountSchema = createSelectSchema(accounts)

export const SelectSessionSchema = createSelectSchema(sessions)

export const SelectCandidateSchema = createSelectSchema(candidates)

export const SelectVoteSchema = createSelectSchema(votes)
