CREATE TRIGGER `votes_require_open_election`
BEFORE INSERT ON `votes`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM `elections`
  WHERE `id` = NEW.election_id
    AND `status` = 'open'
    AND `opens_at` IS NOT NULL
    AND `closes_at` IS NOT NULL
    AND `opens_at` <= unixepoch()
    AND `closes_at` >= unixepoch()
)
BEGIN
  SELECT RAISE(ABORT, 'ELECTION_NOT_OPEN');
END;
