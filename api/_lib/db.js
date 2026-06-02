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
      "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),",
      "last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
      ")",
    ].join(" "));

    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''");
    await sql.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS picture_url TEXT NOT NULL DEFAULT ''");

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
