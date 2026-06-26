import { z } from "@hono/zod-openapi";
import { desc, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-zod";

export const ROLES = z.enum(["user", "admin"]);

export const ELECTION_STATUS = z.enum(["draft", "open", "closed", "archived"]);
export type TElectionStatus = z.infer<typeof ELECTION_STATUS>;

export const accounts = sqliteTable("accounts", {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
  lastLogin: integer("last_login")
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer("deleted_at"),
  id: text("id").primaryKey(),
  role: text("role").notNull().default("user"),
  username: text("username").notNull().unique(),
  email: text("email"),
  password_hash: text("password_hash").notNull(),
});

export const users = sqliteTable("users", {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  studentId: text("student_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  yearLevel: text("year_level").notNull(),
  course: text("course").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

export const elections = sqliteTable(
  "elections",
  {
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    opensAt: integer("opens_at"),
    closesAt: integer("closes_at"),
  },
  (table) => [
    uniqueIndex("idx_elections_one_open")
      .on(table.status)
      .where(sql`${table.status} = 'open'`),
  ],
);

export const positions = sqliteTable(
  "positions",
  {
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
    id: text("id").primaryKey(),
    electionId: text("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (table) => [uniqueIndex("idx_positions_election_name").on(table.electionId, table.name)],
);

// NOTE: libSQL/Turso defaults to `PRAGMA foreign_keys = ON`, so the FK
// constraints declared here ARE enforced at runtime. The `onDelete: 'restrict'`
// on `candidates.position_id`, `votes.position_id`, and `votes.election_id`
// prevents orphaned references. The unique indexes
// (`votes_user_position_election_unique_idx` and
// `votes_user_candidate_unique_idx`) provide additional integrity guarantees
// per the design spec.
export const candidates = sqliteTable("candidates", {
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  positionId: text("position_id")
    .notNull()
    .references(() => positions.id, { onDelete: "restrict" }),
  manifesto: text("manifesto").notNull(),
  isActive: integer("is_active").notNull().default(1),
  imageUrl: text("image_url"),
});

export const votes = sqliteTable(
  "votes",
  {
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => candidates.id),
    positionId: text("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "restrict" }),
    electionId: text("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("votes_user_candidate_unique_idx").on(table.userId, table.candidateId),
    uniqueIndex("votes_user_position_election_unique_idx").on(
      table.userId,
      table.positionId,
      table.electionId,
    ),
  ],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    actorAccountIdSnapshot: text("actor_account_id_snapshot").notNull(),
    actorUsernameSnapshot: text("actor_username_snapshot").notNull(),
    description: text("description"),
  },
  (table) => [
    index("idx_audit_log_created_at_id_desc").on(desc(table.createdAt), desc(table.id)),
    index("idx_audit_log_target_type_target_id").on(table.targetType, table.targetId),
    index("idx_audit_log_actor_account_id_snapshot").on(table.actorAccountIdSnapshot),
    index("idx_audit_log_action").on(table.action),
  ],
);

export const DbSelectUserSchema = createSelectSchema(users);
export const SelectAccountSchema = createSelectSchema(accounts);
export const SelectSessionSchema = createSelectSchema(sessions);
export const SelectElectionSchema = createSelectSchema(elections);
export const SelectPositionSchema = createSelectSchema(positions);
export const SelectCandidateSchema = createSelectSchema(candidates);
export const SelectVoteSchema = createSelectSchema(votes);
