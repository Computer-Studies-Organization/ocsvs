CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`actor_account_id_snapshot` text NOT NULL,
	`actor_username_snapshot` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_created_at_id_desc` ON `audit_log` ("created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `idx_audit_log_target_type_target_id` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_actor_account_id_snapshot` ON `audit_log` (`actor_account_id_snapshot`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_action` ON `audit_log` (`action`);