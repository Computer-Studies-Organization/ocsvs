CREATE TABLE `voter_election_participation` (
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`voter_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_voter_election_participation_unique` ON `voter_election_participation` (`election_id`,`voter_hash`);