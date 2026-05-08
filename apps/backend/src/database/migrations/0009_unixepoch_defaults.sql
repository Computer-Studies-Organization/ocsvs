-- Fix: Change timestamp defaults from CURRENT_TIMESTAMP (text) to unixepoch() (integer)
-- Also converts existing text timestamps to Unix seconds for consistent storage class.
-- Mixed text/integer values in same column break ORDER BY (SQLite sorts by type class).

-- accounts
ALTER TABLE `accounts` ADD COLUMN `__mig_created_at` integer DEFAULT (unixepoch()) NOT NULL;
ALTER TABLE `accounts` ADD COLUMN `__mig_updated_at` integer DEFAULT (unixepoch()) NOT NULL;
ALTER TABLE `accounts` ADD COLUMN `__mig_last_login` integer DEFAULT (unixepoch()) NOT NULL;
UPDATE `accounts` SET
  `__mig_created_at` = CASE WHEN typeof(`created_at`) = 'text' THEN CAST(strftime('%s', `created_at`) AS integer) ELSE `created_at` END,
  `__mig_updated_at` = CASE WHEN typeof(`updated_at`) = 'text' THEN CAST(strftime('%s', `updated_at`) AS integer) ELSE `updated_at` END,
  `__mig_last_login` = CASE WHEN typeof(`last_login`) = 'text' THEN CAST(strftime('%s', `last_login`) AS integer) ELSE `last_login` END;
ALTER TABLE `accounts` DROP COLUMN `created_at`;
ALTER TABLE `accounts` DROP COLUMN `updated_at`;
ALTER TABLE `accounts` DROP COLUMN `last_login`;
ALTER TABLE `accounts` RENAME COLUMN `__mig_created_at` TO `created_at`;
ALTER TABLE `accounts` RENAME COLUMN `__mig_updated_at` TO `updated_at`;
ALTER TABLE `accounts` RENAME COLUMN `__mig_last_login` TO `last_login`;

-- users
ALTER TABLE `users` ADD COLUMN `__mig_created_at` integer DEFAULT (unixepoch()) NOT NULL;
ALTER TABLE `users` ADD COLUMN `__mig_updated_at` integer DEFAULT (unixepoch()) NOT NULL;
UPDATE `users` SET
  `__mig_created_at` = CASE WHEN typeof(`created_at`) = 'text' THEN CAST(strftime('%s', `created_at`) AS integer) ELSE `created_at` END,
  `__mig_updated_at` = CASE WHEN typeof(`updated_at`) = 'text' THEN CAST(strftime('%s', `updated_at`) AS integer) ELSE `updated_at` END;
ALTER TABLE `users` DROP COLUMN `created_at`;
ALTER TABLE `users` DROP COLUMN `updated_at`;
ALTER TABLE `users` RENAME COLUMN `__mig_created_at` TO `created_at`;
ALTER TABLE `users` RENAME COLUMN `__mig_updated_at` TO `updated_at`;

-- candidates
ALTER TABLE `candidates` ADD COLUMN `__mig_created_at` integer DEFAULT (unixepoch()) NOT NULL;
ALTER TABLE `candidates` ADD COLUMN `__mig_updated_at` integer DEFAULT (unixepoch()) NOT NULL;
UPDATE `candidates` SET
  `__mig_created_at` = CASE WHEN typeof(`created_at`) = 'text' THEN CAST(strftime('%s', `created_at`) AS integer) ELSE `created_at` END,
  `__mig_updated_at` = CASE WHEN typeof(`updated_at`) = 'text' THEN CAST(strftime('%s', `updated_at`) AS integer) ELSE `updated_at` END;
ALTER TABLE `candidates` DROP COLUMN `created_at`;
ALTER TABLE `candidates` DROP COLUMN `updated_at`;
ALTER TABLE `candidates` RENAME COLUMN `__mig_created_at` TO `created_at`;
ALTER TABLE `candidates` RENAME COLUMN `__mig_updated_at` TO `updated_at`;

-- votes
ALTER TABLE `votes` ADD COLUMN `__mig_created_at` integer DEFAULT (unixepoch()) NOT NULL;
ALTER TABLE `votes` ADD COLUMN `__mig_updated_at` integer DEFAULT (unixepoch()) NOT NULL;
UPDATE `votes` SET
  `__mig_created_at` = CASE WHEN typeof(`created_at`) = 'text' THEN CAST(strftime('%s', `created_at`) AS integer) ELSE `created_at` END,
  `__mig_updated_at` = CASE WHEN typeof(`updated_at`) = 'text' THEN CAST(strftime('%s', `updated_at`) AS integer) ELSE `updated_at` END;
ALTER TABLE `votes` DROP COLUMN `created_at`;
ALTER TABLE `votes` DROP COLUMN `updated_at`;
ALTER TABLE `votes` RENAME COLUMN `__mig_created_at` TO `created_at`;
ALTER TABLE `votes` RENAME COLUMN `__mig_updated_at` TO `updated_at`;
