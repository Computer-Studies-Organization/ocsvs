import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

// const users = sqliteTable('users', {
//   createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
//   updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
//   lastLogin: integer('last_login').notNull().default(sql`CURRENT_TIMESTAMP`),
//   id: text('id').primaryKey(),
//   firstName: text('firstName').notNull(),
//   lastName: text('lastName').notNull(),
//   email: text('email').notNull(),
//   password_hash: text('password_hash').notNull(),
// })

export const items = sqliteTable('items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  available: integer('available', { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`).$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
})

export const selectItemsSchema = createSelectSchema(items)

export const insertItemSchema = createInsertSchema(items)
  .required({
    name: true,
    description: true,
    available: true,
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })

export const patchItemsSchema = insertItemSchema.partial()

export const apiItemsSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  available: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const insertItemApiSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty'),
  description: z.string().min(1, 'Description cannot be empty'),
  available: z.boolean(),
})

export const patchItemApiSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').optional(),
  description: z.string().min(1, 'Description cannot be empty').optional(),
  available: z.boolean().optional(),
})
