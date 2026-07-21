ALTER TABLE recruit_posts
ADD COLUMN IF NOT EXISTS region_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE recruit_posts
SET region_categories = ARRAY[region_category]
WHERE cardinality(region_categories) = 0;

CREATE INDEX IF NOT EXISTS recruit_posts_region_categories_idx
ON recruit_posts USING GIN (region_categories);
