CREATE TABLE `party_lists` (
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`color` text,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_party_lists_election_name` ON `party_lists` (`election_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_party_lists_election_code` ON `party_lists` (`election_id`,`code`);--> statement-breakpoint
ALTER TABLE `candidates` ADD `party_id` text REFERENCES party_lists(id);