-- Renumber display_order sequentially per election to eliminate any existing duplicates
-- Preserves relative ordering (display_order ASC, then created_at ASC as tiebreaker)
WITH numbered_positions AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY election_id ORDER BY display_order ASC, created_at ASC) - 1 as new_order
  FROM positions
)
UPDATE positions
SET display_order = (
  SELECT new_order FROM numbered_positions WHERE numbered_positions.id = positions.id
);
--> statement-breakpoint
-- Now create the unique index
CREATE UNIQUE INDEX `idx_positions_election_display_order` ON `positions` (`election_id`,`display_order`);