-- Manual migration: Make email nullable in accounts table
PRAGMA foreign_keys=OFF;

-- Create new accounts table with nullable email
CREATE TABLE `__new_accounts` (
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_login` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL
);

-- Copy data from old table
INSERT INTO `__new_accounts`("created_at", "updated_at", "last_login", "id", "role", "username", "email", "password_hash") 
SELECT "created_at", "updated_at", "last_login", "id", "role", "username", "email", "password_hash" FROM `accounts`;

-- Drop old table
DROP TABLE `accounts`;

-- Rename new table
ALTER TABLE `__new_accounts` RENAME TO `accounts`;

PRAGMA foreign_keys=ON;

-- Recreate indexes
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);
