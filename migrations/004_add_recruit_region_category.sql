BEGIN;

ALTER TABLE recruit_posts
  ADD COLUMN IF NOT EXISTS region_category TEXT NOT NULL DEFAULT '전국·온라인';

UPDATE recruit_posts
SET region_category = CASE
  WHEN region LIKE '%서울%' THEN '서울'
  WHEN region LIKE '%경기%' OR region LIKE '%수원%' OR region LIKE '%성남%' OR region LIKE '%고양%' THEN '경기'
  WHEN region LIKE '%인천%' THEN '인천'
  WHEN region LIKE '%강원%' THEN '강원'
  WHEN region LIKE '%대전%' OR region LIKE '%세종%' OR region LIKE '%충청%' OR region LIKE '%충북%' OR region LIKE '%충남%' THEN '대전·세종·충청'
  WHEN region LIKE '%광주%' OR region LIKE '%전라%' OR region LIKE '%전북%' OR region LIKE '%전남%' THEN '광주·전라'
  WHEN region LIKE '%대구%' OR region LIKE '%경북%' THEN '대구·경북'
  WHEN region LIKE '%부산%' OR region LIKE '%울산%' OR region LIKE '%경남%' THEN '부산·울산·경남'
  WHEN region LIKE '%제주%' THEN '제주'
  ELSE '전국·온라인'
END
WHERE region_category = '전국·온라인' AND region <> '';

CREATE INDEX IF NOT EXISTS recruit_posts_region_category_idx
  ON recruit_posts (intent, region_category, created_at DESC);

COMMIT;
