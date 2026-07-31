DROP INDEX `idx_party_lists_election_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_party_lists_election_name` ON `party_lists` (`election_id`,"name" COLLATE NOCASE);