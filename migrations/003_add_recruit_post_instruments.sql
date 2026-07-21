BEGIN;

ALTER TABLE recruit_posts
  ADD COLUMN IF NOT EXISTS instruments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE recruit_posts
SET instruments = ARRAY[instrument]
WHERE cardinality(instruments) = 0;

CREATE INDEX IF NOT EXISTS recruit_posts_instruments_idx
  ON recruit_posts USING GIN (instruments);

COMMIT;
