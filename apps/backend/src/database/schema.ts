import { z } from "@hono/zod-openapi";
import { desc, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ROLES = z.enum(["user", "admin", "super_admin"]);

export const ELECTION_STATUS = z.enum(["draft", "open", "closed", "archived"]);
export type TElectionStatus = z.infer<typeof ELECTION_STATUS>;

export const accounts = sqliteTable(
  "accounts",
  {
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
  },
  (table) => [index("idx_accounts_role_deleted_at").on(table.role, table.deletedAt)],
);

export const users = sqliteTable(
  "users",
  {
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
  },
  (table) => [uniqueIndex("idx_users_account_id").on(table.accountId)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("idx_sessions_account_id").on(table.accountId)],
);

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
    eligibleVotersCount: integer("eligible_voters_count"),
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
  (table) => [
    uniqueIndex("idx_positions_election_name").on(table.electionId, table.name),
    uniqueIndex("idx_positions_election_display_order").on(table.electionId, table.displayOrder),
  ],
);

export const partyLists = sqliteTable(
  "party_lists",
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
    code: text("code").notNull(),
    color: text("color"),
    description: text("description"),
  },
  (table) => [
    uniqueIndex("idx_party_lists_election_name").on(
      table.electionId,
      sql`${table.name} COLLATE NOCASE`,
    ),
    uniqueIndex("idx_party_lists_election_code").on(
      table.electionId,
      sql`${table.code} COLLATE NOCASE`,
    ),
  ],
);

// NOTE: libSQL/Turso defaults to `PRAGMA foreign_keys = ON`, so the FK
// constraints declared here ARE enforced at runtime. The `onDelete: 'restrict'`
// on `candidates.position_id`, `votes.position_id`, and `votes.election_id`
// prevents orphaned references. The unique indexes
// (`votes_user_position_election_unique_idx` and
// `votes_user_candidate_unique_idx`) are retained for legacy rows only. The
// nullable user_id column is kept for mixed-version migration compatibility;
// new ballots always write NULL and use voter_election_participation for the
// one-ballot-per-voter invariant.
export const candidates = sqliteTable(
  "candidates",
  {
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
      .references(() => users.accountId),
    positionId: text("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "restrict" }),
    // NOTE: onDelete: "set null" is declared here but is silently dropped by
    // Drizzle when generating the ALTER TABLE ADD COLUMN migration (bug #5619:
    // https://github.com/drizzle-team/drizzle-orm/issues/5619). The DB-level FK
    // therefore acts as NO ACTION (RESTRICT). partyListRepo.delete() compensates
    // by manually nullifying this column before deleting the party row.
    partyId: text("party_id").references(() => partyLists.id, { onDelete: "set null" }),

    manifesto: text("manifesto").notNull(),
    isActive: integer("is_active").notNull().default(1),
    imageUrl: text("image_url"),
  },
  (table) => [
    index("idx_candidates_position_id").on(table.positionId),
    uniqueIndex("idx_candidates_active_party_position")
      .on(table.positionId, table.partyId)
      .where(sql`${table.isActive} = 1 AND ${table.partyId} IS NOT NULL`),
  ],
);

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
    // Legacy account link. Never populate this for newly cast ballots.
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
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
    index("idx_votes_election_candidate").on(table.electionId, table.candidateId),
    index("idx_votes_candidate_id").on(table.candidateId),
    uniqueIndex("votes_user_candidate_unique_idx").on(table.userId, table.candidateId),
    uniqueIndex("votes_user_position_election_unique_idx").on(
      table.userId,
      table.positionId,
      table.electionId,
    ),
  ],
);

// One row is written atomically alongside vote inserts. No user_id is stored
// here — the count is durable across voter hard-deletes, giving accurate
// turnout statistics even after anonymisation.
export const ballotSnapshots = sqliteTable(
  "ballot_snapshots",
  {
    id: text("id").primaryKey(),
    electionId: text("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "restrict" }),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index("idx_ballot_snapshots_election_id").on(table.electionId)],
);

// Durable voter participation record separate from ballot contents.
// New participation records use a deterministic keyed HMAC-SHA256 value (prefixed with "v1:")
// using a secret pepper (HMAC_SECRET) so the row survives account hard-deletes and blocks
// re-imported accounts from double-voting. Unprefixed legacy SHA-256 records may remain
// during migration and are checked temporarily to preserve durable double-voting protection.
export const voterElectionParticipation = sqliteTable(
  "voter_election_participation",
  {
    id: text("id").primaryKey(),
    electionId: text("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "restrict" }),
    voterHash: text("voter_hash").notNull(),
    // Writers store the privacy sentinel 0; exact ballot timing can correlate hashes to selections.
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("idx_voter_election_participation_unique").on(table.electionId, table.voterHash),
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

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    attemptedAt: integer("attempted_at")
      .notNull()
      .default(sql`(unixepoch())`),
    ipAddress: text("ip_address"),
  },
  (table) => [
    index("idx_login_attempts_identifier_attempted_at").on(
      table.identifier,
      desc(table.attemptedAt),
    ),
  ],
);
