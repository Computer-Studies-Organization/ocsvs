ALTER TABLE `elections` ADD `eligible_voters_count` integer;

-- Historical elections do not carry a roster snapshot.  The current account
-- table cannot reconstruct their denominator (and deleted accounts may still
-- own legacy ballots), so NULL deliberately means historical turnout is
-- unavailable.  New elections snapshot the active voter roster when the
-- draft -> open transition is committed by the application.
