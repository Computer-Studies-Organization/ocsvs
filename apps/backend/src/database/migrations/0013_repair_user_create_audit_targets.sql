-- Repair user.create rows written before audit targets used users.id.
-- Rows for hard-deleted users cannot be mapped because their user row is gone.
UPDATE audit_log
SET target_id = (
  SELECT users.id
  FROM users
  WHERE users.account_id = audit_log.target_id
)
WHERE audit_log.action = 'user.create'
  AND audit_log.target_type = 'user'
  AND EXISTS (
    SELECT 1
    FROM users
    WHERE users.account_id = audit_log.target_id
  );
