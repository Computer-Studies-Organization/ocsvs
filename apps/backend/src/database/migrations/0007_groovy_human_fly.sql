CREATE TABLE `ballot_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`election_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`election_id`) REFERENCES `elections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_ballot_snapshots_election_id` ON `ballot_snapshots` (`election_id`);