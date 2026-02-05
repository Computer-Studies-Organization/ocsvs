import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

const users = sqliteTable("users", {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  id: text("id").primaryKey(),
  studentId: text("id").notNull(),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  email: text("email").notNull(),
  password_hash: text("password_hash").notNull(),
});

const accounts = sqliteTable("accounts", {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  lastLogin: integer("last_login")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  password_hash: text("password_hash").notNull(),
});

export const SelectUserSchema = createSelectSchema(users);

export const SelectAccountSchema = createSelectSchema(accounts);
