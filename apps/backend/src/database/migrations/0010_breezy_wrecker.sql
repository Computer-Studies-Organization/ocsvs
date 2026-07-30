DROP INDEX `idx_party_lists_election_code`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_party_lists_election_code` ON `party_lists` (`election_id`,"code" COLLATE NOCASE);