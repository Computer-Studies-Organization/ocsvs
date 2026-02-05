import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  studentId: text("student_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  hasVoted: integer("has_voted").notNull().default(0),
});

export const accounts = sqliteTable("accounts", {
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
  role: text("role").notNull(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  password_hash: text("password_hash").notNull(),
});

export const SelectUserSchema = createSelectSchema(users);

export const SelectAccountSchema = createSelectSchema(accounts);
