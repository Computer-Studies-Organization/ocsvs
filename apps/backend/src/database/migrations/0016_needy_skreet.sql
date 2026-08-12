CREATE TEMP TABLE `__candidate_user_integrity_check` (`valid` integer NOT NULL CHECK (`valid` = 1));--> statement-breakpoint
INSERT INTO `__candidate_user_integrity_check` (`valid`)
SELECT CASE WHEN
	EXISTS (SELECT 1 FROM `users` GROUP BY `account_id` HAVING count(*) > 1)
	OR EXISTS (
		SELECT 1 FROM `candidates`
		LEFT JOIN `users` ON `users`.`account_id` = `candidates`.`account_id`
		WHERE `users`.`id` IS NULL
	)
THEN 0 ELSE 1 END;--> statement-breakpoint
DROP TABLE `__candidate_user_integrity_check`;--> statement-breakpoint
DROP INDEX `idx_users_account_id`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_account_id` ON `users` (`account_id`);--> statement-breakpoint
CREATE TEMP TABLE `__votes_backup` AS SELECT `created_at`, `updated_at`, `id`, `user_id`, `candidate_id`, `position_id`, `election_id` FROM `votes`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
CREATE TABLE `__new_candidates` (
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`account_id` text NOT NULL,
	`position_id` text NOT NULL,
	`party_id` text,
	`manifesto` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`image_url` text,
	FOREIGN KEY (`account_id`) REFERENCES `users`(`account_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`party_id`) REFERENCES `party_lists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_candidates`("created_at", "updated_at", "id", "full_name", "account_id", "position_id", "party_id", "manifesto", "is_active", "image_url") SELECT "created_at", "updated_at", "id", "full_name", "account_id", "position_id", "party_id", "manifesto", "is_active", "image_url" FROM `candidates`;--> statement-breakpoint
DROP TABLE `candidates`;--> statement-breakpoint
ALTER TABLE `__new_candidates` RENAME TO `candidates`;--> statement-breakpoint
CREATE INDEX `idx_candidates_position_id` ON `candidates` (`position_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_candidates_active_party_position` ON `candidates` (`position_id`,`party_id`) WHERE "candidates"."is_active" = 1 AND "candidates"."party_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `votes` (
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`candidate_id` text NOT NULL,
	`position_id` text NOT NULL,
	`election_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `votes`("created_at", "updated_at", "id", "user_id", "candidate_id", "position_id", "election_id") SELECT "created_at", "updated_at", "id", "user_id", "candidate_id", "position_id", "election_id" FROM `__votes_backup`;--> statement-breakpoint
DROP TABLE `__votes_backup`;--> statement-breakpoint
CREATE INDEX `idx_votes_candidate_id` ON `votes` (`candidate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `votes_user_candidate_unique_idx` ON `votes` (`user_id`,`candidate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `votes_user_position_election_unique_idx` ON `votes` (`user_id`,`position_id`,`election_id`);
