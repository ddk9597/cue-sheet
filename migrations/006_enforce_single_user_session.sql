BEGIN;

DELETE FROM user_sessions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY (expires_at > NOW()) DESC, last_seen_at DESC, created_at DESC, id DESC
      ) AS session_rank
    FROM user_sessions
  ) ranked_sessions
  WHERE session_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_user_id_unique_idx
  ON user_sessions (user_id);

COMMIT;
