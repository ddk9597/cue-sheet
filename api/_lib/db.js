const { neon } = require("@neondatabase/serverless");

const SCHEMA_LOCK_ID = 58022746;
const LEGACY_STORAGE_ROW_ID = 1;
const PRACTICE_LOG_ROW_ID = 1;
const TODO_DOCUMENT_ROW_ID = 1;
let schemaReadyPromise = null;

function getConnectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function getSql() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

async function ensureSchema(sql) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureSchemaLocked(sql).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}

async function ensureSchemaLocked(sql) {
  await sql.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK_ID]);

  try {
    await sql.query([
      "CREATE TABLE IF NOT EXISTS cue_sheet_state (",
      "id SMALLINT PRIMARY KEY,",
      "items JSONB NOT NULL DEFAULT '[]'::jsonb,",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS app_users (",
      "id BIGSERIAL PRIMARY KEY,",
      "email TEXT NOT NULL UNIQUE,",
      "google_sub TEXT UNIQUE,",
      "name TEXT NOT NULL DEFAULT '',",
      "picture_url TEXT NOT NULL DEFAULT '',",
      "picture_key TEXT NOT NULL DEFAULT '',",
      "pending_picture_key TEXT NOT NULL DEFAULT '',",
      "region TEXT NOT NULL DEFAULT '',",
      "\"position\" TEXT NOT NULL DEFAULT '',",
      "genre TEXT NOT NULL DEFAULT '',",
      "birth_date TEXT NOT NULL DEFAULT '',",
      "phone TEXT NOT NULL DEFAULT '',",
      "memo TEXT NOT NULL DEFAULT '',",
      "password_hash TEXT NOT NULL DEFAULT '',",
      "password_salt TEXT NOT NULL DEFAULT '',",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS picture_url TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS picture_key TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS pending_picture_key TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS \"position\" TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS genre TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS birth_date TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS memo TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_salt TEXT NOT NULL DEFAULT ''");

    await sql.query([
      "CREATE TABLE IF NOT EXISTS user_sessions (",
      "id BIGSERIAL PRIMARY KEY,",
      "user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "token_hash TEXT NOT NULL UNIQUE,",
      "expires_at TIMESTAMPTZ NOT NULL,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx",
      "ON user_sessions (user_id)",
    ].join(" "));

    await sql.query([
      "DELETE FROM user_sessions",
      "WHERE id IN (",
      "SELECT id FROM (",
      "SELECT id, ROW_NUMBER() OVER (",
      "PARTITION BY user_id",
      "ORDER BY (expires_at > NOW()) DESC, last_seen_at DESC, created_at DESC, id DESC",
      ") AS session_rank",
      "FROM user_sessions",
      ") ranked_sessions",
      "WHERE session_rank > 1",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_user_id_unique_idx",
      "ON user_sessions (user_id)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS email_auth_challenges (",
      "id BIGSERIAL PRIMARY KEY,",
      "email TEXT NOT NULL,",
      "code_hash TEXT NOT NULL,",
      "attempts INTEGER NOT NULL DEFAULT 0,",
      "expires_at TIMESTAMPTZ NOT NULL,",
      "consumed_at TIMESTAMPTZ,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS email_auth_challenges_email_idx",
      "ON email_auth_challenges (email, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS user_cue_sheet_state (",
      "user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,",
      "items JSONB NOT NULL DEFAULT '[]'::jsonb,",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS groups (",
      "id BIGSERIAL PRIMARY KEY,",
      "name TEXT NOT NULL DEFAULT '',",
      "description TEXT NOT NULL DEFAULT '',",
      "owner_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query("ALTER TABLE groups ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''");

    await sql.query([
      "CREATE INDEX IF NOT EXISTS groups_owner_user_id_idx",
      "ON groups (owner_user_id)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS group_members (",
      "group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,",
      "user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),",
      "status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active')),",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "PRIMARY KEY (group_id, user_id)",
      ")",
    ].join(" "));

    await sql.query("ALTER TABLE group_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active'))");

    await sql.query([
      "CREATE INDEX IF NOT EXISTS group_members_user_id_idx",
      "ON group_members (user_id)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS group_invites (",
      "id BIGSERIAL PRIMARY KEY,",
      "group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,",
      "inviter_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "invitee_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "invitee_email TEXT NOT NULL DEFAULT '',",
      "token TEXT NOT NULL DEFAULT '',",
      "status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "responded_at TIMESTAMPTZ,",
      "accepted_at TIMESTAMPTZ,",
      "rejected_at TIMESTAMPTZ,",
      "read_at TIMESTAMPTZ",
      ")",
    ].join(" "));

    await sql.query("ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS invitee_email TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS token TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ");
    await sql.query("ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ");
    await sql.query("ALTER TABLE group_invites ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ");

    await sql.query([
      "CREATE UNIQUE INDEX IF NOT EXISTS group_invites_pending_unique_idx",
      "ON group_invites (group_id, invitee_user_id)",
      "WHERE status = 'pending'",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS group_invites_invitee_user_id_idx",
      "ON group_invites (invitee_user_id, status, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS group_messages (",
      "id BIGSERIAL PRIMARY KEY,",
      "group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,",
      "user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "type TEXT NOT NULL DEFAULT 'notice' CHECK (type IN ('notice', 'cue_request')),",
      "title TEXT NOT NULL DEFAULT '',",
      "body TEXT NOT NULL DEFAULT '',",
      "related_invite_id BIGINT REFERENCES group_invites(id) ON DELETE SET NULL,",
      "related_cue_id BIGINT,",
      "is_read BOOLEAN NOT NULL DEFAULT FALSE,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS group_messages_user_id_idx",
      "ON group_messages (user_id, is_read, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS group_messages_group_id_idx",
      "ON group_messages (group_id, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS group_cues (",
      "id BIGSERIAL PRIMARY KEY,",
      "group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,",
      "title TEXT NOT NULL DEFAULT '',",
      "cue_data JSONB NOT NULL DEFAULT '[]'::jsonb,",
      "created_by BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "updated_by BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS group_cues_group_id_idx",
      "ON group_cues (group_id, updated_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS performances (",
      "id BIGSERIAL PRIMARY KEY,",
      "group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,",
      "title TEXT NOT NULL DEFAULT '',",
      "performance_date TEXT NOT NULL DEFAULT '',",
      "location TEXT NOT NULL DEFAULT '',",
      "memo TEXT NOT NULL DEFAULT '',",
      "created_by BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS recruit_posts (",
      "id BIGSERIAL PRIMARY KEY,",
      "user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "intent TEXT NOT NULL CHECK (intent IN ('구해요', '할래요')),",
      "instrument TEXT NOT NULL CHECK (instrument IN ('일렉', '드럼', '기타', '베이스', '보컬', '신디')),",
      "instruments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],",
      "title TEXT NOT NULL DEFAULT '',",
      "region TEXT NOT NULL DEFAULT '',",
      "region_category TEXT NOT NULL DEFAULT '전국·온라인',",
      "region_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],",
      "genre TEXT NOT NULL DEFAULT '',",
      "schedule TEXT NOT NULL DEFAULT '',",
      "content TEXT NOT NULL DEFAULT '',",
      "contact TEXT NOT NULL DEFAULT '',",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query(
      "ALTER TABLE recruit_posts ADD COLUMN IF NOT EXISTS instruments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]",
    );
    await sql.query(
      "ALTER TABLE recruit_posts ADD COLUMN IF NOT EXISTS region_category TEXT NOT NULL DEFAULT '전국·온라인'",
    );
    await sql.query(
      "ALTER TABLE recruit_posts ADD COLUMN IF NOT EXISTS region_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]",
    );
    await sql.query([
      "UPDATE recruit_posts",
      "SET instruments = ARRAY[instrument]",
      "WHERE cardinality(instruments) = 0",
    ].join(" "));
    await sql.query([
      "UPDATE recruit_posts",
      "SET region_category = CASE",
      "WHEN region LIKE '%서울%' THEN '서울'",
      "WHEN region LIKE '%경기%' OR region LIKE '%수원%' OR region LIKE '%성남%' OR region LIKE '%고양%' THEN '경기'",
      "WHEN region LIKE '%인천%' THEN '인천'",
      "WHEN region LIKE '%강원%' THEN '강원'",
      "WHEN region LIKE '%대전%' OR region LIKE '%세종%' OR region LIKE '%충청%' OR region LIKE '%충북%' OR region LIKE '%충남%' THEN '대전·세종·충청'",
      "WHEN region LIKE '%광주%' OR region LIKE '%전라%' OR region LIKE '%전북%' OR region LIKE '%전남%' THEN '광주·전라'",
      "WHEN region LIKE '%대구%' OR region LIKE '%경북%' THEN '대구·경북'",
      "WHEN region LIKE '%부산%' OR region LIKE '%울산%' OR region LIKE '%경남%' THEN '부산·울산·경남'",
      "WHEN region LIKE '%제주%' THEN '제주'",
      "ELSE '전국·온라인' END",
      "WHERE region_category = '전국·온라인' AND region <> ''",
    ].join(" "));
    await sql.query([
      "UPDATE recruit_posts",
      "SET region_categories = ARRAY[region_category]",
      "WHERE cardinality(region_categories) = 0",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS recruit_posts_created_at_idx",
      "ON recruit_posts (created_at DESC, id DESC)",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS recruit_posts_category_idx",
      "ON recruit_posts (intent, instrument, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS recruit_posts_instruments_idx",
      "ON recruit_posts USING GIN (instruments)",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS recruit_posts_region_category_idx",
      "ON recruit_posts (intent, region_category, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS recruit_posts_region_categories_idx",
      "ON recruit_posts USING GIN (region_categories)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS recruit_comments (",
      "id BIGSERIAL PRIMARY KEY,",
      "post_id BIGINT NOT NULL REFERENCES recruit_posts(id) ON DELETE CASCADE,",
      "user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "content TEXT NOT NULL DEFAULT '',",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS recruit_comments_post_id_idx",
      "ON recruit_comments (post_id, created_at ASC, id ASC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS community_posts (",
      "id BIGSERIAL PRIMARY KEY,",
      "user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "category TEXT NOT NULL CHECK (category IN ('자유', '합주·친목', '공연·모임', '정보공유')),",
      "title TEXT NOT NULL DEFAULT '',",
      "content TEXT NOT NULL DEFAULT '',",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS community_posts_category_created_at_idx",
      "ON community_posts (category, created_at DESC, id DESC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS community_comments (",
      "id BIGSERIAL PRIMARY KEY,",
      "post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,",
      "user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "content TEXT NOT NULL DEFAULT '',",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS community_comments_post_id_idx",
      "ON community_comments (post_id, created_at ASC, id ASC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS direct_messages (",
      "id BIGSERIAL PRIMARY KEY,",
      "sender_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "recipient_user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,",
      "recruit_post_id BIGINT REFERENCES recruit_posts(id) ON DELETE SET NULL,",
      "subject TEXT NOT NULL DEFAULT '',",
      "body TEXT NOT NULL DEFAULT '',",
      "is_read BOOLEAN NOT NULL DEFAULT FALSE,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS direct_messages_recipient_user_id_idx",
      "ON direct_messages (recipient_user_id, is_read, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS direct_messages_sender_user_id_idx",
      "ON direct_messages (sender_user_id, created_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS performances_group_id_idx",
      "ON performances (group_id, performance_date, updated_at DESC)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS performance_cues (",
      "id BIGSERIAL PRIMARY KEY,",
      "performance_id BIGINT NOT NULL REFERENCES performances(id) ON DELETE CASCADE,",
      "group_cue_id BIGINT NOT NULL REFERENCES group_cues(id) ON DELETE CASCADE,",
      "sort_order INTEGER NOT NULL DEFAULT 0,",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "UNIQUE (performance_id, group_cue_id)",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE INDEX IF NOT EXISTS performance_cues_performance_id_idx",
      "ON performance_cues (performance_id, sort_order, id)",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS user_memos (",
      "user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,",
      "content TEXT NOT NULL DEFAULT '',",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS user_practice_calendar_state (",
      "user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,",
      "logs JSONB NOT NULL DEFAULT '{}'::jsonb,",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS user_todo_document_state (",
      "user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,",
      "html TEXT NOT NULL DEFAULT '',",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS save_password_attempts (",
      "ip_address TEXT PRIMARY KEY,",
      "failure_count INTEGER NOT NULL DEFAULT 0,",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS practice_calendar_state (",
      "id SMALLINT PRIMARY KEY,",
      "logs JSONB NOT NULL DEFAULT '{}'::jsonb,",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query([
      "CREATE TABLE IF NOT EXISTS todo_document_state (",
      "id SMALLINT PRIMARY KEY,",
      "html TEXT NOT NULL DEFAULT '',",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));
  } finally {
    await sql.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_ID]);
  }
}

module.exports = {
  LEGACY_STORAGE_ROW_ID,
  PRACTICE_LOG_ROW_ID,
  TODO_DOCUMENT_ROW_ID,
  ensureSchema,
  getConnectionString,
  getSql,
};
