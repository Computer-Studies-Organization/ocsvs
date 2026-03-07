PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_votes` (
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`position` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_votes`("created_at", "updated_at", "id", "user_id", "candidate_id", "position")
SELECT `votes`.`created_at`, `votes`.`updated_at`, `votes`.`id`, `votes`.`user_id`, `votes`.`candidate_id`, `candidates`.`position`
FROM `votes`
INNER JOIN `candidates` ON `votes`.`candidate_id` = `candidates`.`id`;
--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
ALTER TABLE `__new_votes` RENAME TO `votes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `votes_user_candidate_unique_idx` ON `votes` (`user_id`,`candidate_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `votes_user_position_unique_idx` ON `votes` (`user_id`,`position`);--> statement-breakpoint
