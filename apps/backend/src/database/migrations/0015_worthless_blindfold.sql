CREATE INDEX `idx_candidates_position_id` ON `candidates` (`position_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_account_id` ON `sessions` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_users_account_id` ON `users` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_votes_candidate_id` ON `votes` (`candidate_id`);