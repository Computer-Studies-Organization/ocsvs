CREATE INDEX `idx_accounts_role_deleted_at` ON `accounts` (`role`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_votes_election_candidate` ON `votes` (`election_id`,`candidate_id`);