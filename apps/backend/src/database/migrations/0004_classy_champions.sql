CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`attempted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`ip_address` text
);
--> statement-breakpoint
CREATE INDEX `idx_login_attempts_identifier_attempted_at` ON `login_attempts` (`identifier`,"attempted_at" desc);