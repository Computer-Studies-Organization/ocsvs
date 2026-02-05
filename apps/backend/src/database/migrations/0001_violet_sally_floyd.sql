ALTER TABLE `accounts` RENAME COLUMN "name" TO "username";--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN "firstName" TO "first_name";--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN "lastName" TO "last_name";--> statement-breakpoint
ALTER TABLE `accounts` ADD `role` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `account_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `has_voted` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `email`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `password_hash`;