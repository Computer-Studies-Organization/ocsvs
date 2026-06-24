-- Hand-patched after `pnpm db:generate`.
--
-- Destructive (clean-slate path). Clears `votes` and `candidates` before
-- adding the NOT NULL `position_id` columns. Order matters: `votes` first
-- because `votes.candidate_id` references `candidates`. (The "can't DELETE
-- a referenced row when foreign_keys=ON" rule from SQLite doesn't apply
-- here because we don't set `PRAGMA foreign_keys = ON` in `src/config/db`;
-- see the FK action note below.)
--
-- FK action note: `votes.position_id`, `votes.election_id`, and
-- `candidates.position_id` are declared `onDelete: 'restrict'` in schema.ts.
-- SQLite's `ALTER TABLE ADD COLUMN REFERENCES` cannot express ON DELETE,
-- so the DB ends up with NO ACTION. Because `PRAGMA foreign_keys` is not
-- set in `src/config/db` (the default in SQLite is OFF), the FK
-- constraints are stored in the schema but not enforced at runtime. Vote
-- integrity is therefore upheld by the unique indexes — specifically
-- `votes_user_position_election_unique_idx` and
-- `votes_user_candidate_unique_idx` — which the application relies on as
-- the source of truth (see spec §"API surface" / "The 'has voted' check is
-- derived … The unique index is the source of truth."). If FK enforcement
-- is later turned on, this migration's `ALTER TABLE … ADD COLUMN … NOT
-- NULL REFERENCES …` will fail; the cleanest fix is to switch to a
-- table-recreation migration.
--
-- For environments with real vote data, replace the DELETEs with a
-- backfill: insert a "Legacy" election, seed `positions` from distinct
-- `candidates.position` values, reassign FKs, then drop the text columns.
--
-- Not reversible. Coordinate a maintenance window before applying in prod.

CREATE TABLE `elections` (
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`opens_at` integer,
	`closes_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_elections_one_open` ON `elections` (`status`) WHERE "elections"."status" = 'open';--> statement-breakpoint
CREATE TABLE `positions` (
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_positions_election_name` ON `positions` (`election_id`,`name`);--> statement-breakpoint
DROP INDEX `votes_user_position_unique_idx`;--> statement-breakpoint
DELETE FROM `votes`;--> statement-breakpoint
DELETE FROM `candidates`;--> statement-breakpoint
ALTER TABLE `votes` ADD `position_id` text NOT NULL REFERENCES positions(id);--> statement-breakpoint
ALTER TABLE `votes` ADD `election_id` text NOT NULL REFERENCES elections(id);--> statement-breakpoint
CREATE UNIQUE INDEX `votes_user_position_election_unique_idx` ON `votes` (`user_id`,`position_id`,`election_id`);--> statement-breakpoint
ALTER TABLE `votes` DROP COLUMN `position`;--> statement-breakpoint
ALTER TABLE `candidates` ADD `position_id` text NOT NULL REFERENCES positions(id);--> statement-breakpoint
ALTER TABLE `candidates` DROP COLUMN `position`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `has_voted`;
