PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_votes` (
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
);
--> statement-breakpoint
INSERT INTO `__new_votes`("created_at", "updated_at", "id", "user_id", "candidate_id", "position_id", "election_id") SELECT "created_at", "updated_at", "id", "user_id", "candidate_id", "position_id", "election_id" FROM `votes`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
ALTER TABLE `__new_votes` RENAME TO `votes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `votes_user_candidate_unique_idx` ON `votes` (`user_id`,`candidate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `votes_user_position_election_unique_idx` ON `votes` (`user_id`,`position_id`,`election_id`);