const { neon } = require("@neondatabase/serverless");

const STORAGE_ROW_ID = 1;
const SCHEMA_LOCK_ID = 58022746;
const ACOUSTIC_TUNING_FIELD = "acousticTuning";
const ELECTRIC_TUNING_FIELD = "electricTuning";
const BASS_TUNING_FIELD = "bassTuning";
const TUNING_STANDARD = "standard";
const TUNING_HALF_DOWN = "half-down";
const TUNING_D_DROP = "d-drop";
const TUNING_INACTIVE = "inactive";
let schemaReadyPromise = null;

module.exports = async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method === "OPTIONS") {
    response.setHeader("Allow", "GET, PUT, OPTIONS");
    response.status(204).end();
    return;
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    response.status(503).json({
      error: "database_not_configured",
      message: "DATABASE_URL or POSTGRES_URL is required.",
    });
    return;
  }

  const sql = neon(connectionString);

  try {
    await ensureSchema(sql);

    if (request.method === "GET") {
      const rows = await sql.query(
        "SELECT items, updated_at FROM cue_sheet_state WHERE id = $1 LIMIT 1",
        [STORAGE_ROW_ID],
      );
      const row = rows[0];

      response.status(200).json({
        items: normalizeCueList(row?.items),
        updatedAt: row?.updated_at ?? null,
      });
      return;
    }

    if (request.method === "PUT") {
      const items = normalizeCueList(request.body?.items);
      const rows = await sql.query(
        [
          "INSERT INTO cue_sheet_state (id, items, updated_at)",
          "VALUES ($1, $2::jsonb, NOW())",
          "ON CONFLICT (id)",
          "DO UPDATE SET items = EXCLUDED.items, updated_at = NOW()",
          "RETURNING updated_at",
        ].join(" "),
        [STORAGE_ROW_ID, JSON.stringify(items)],
      );

      response.status(200).json({
        items,
        updatedAt: rows[0]?.updated_at ?? null,
      });
      return;
    }

    response.setHeader("Allow", "GET, PUT, OPTIONS");
    response.status(405).json({
      error: "method_not_allowed",
      message: "Only GET and PUT are supported.",
    });
  } catch (error) {
    console.error("cue api error", error);
    response.status(500).json({
      error: "database_error",
      message: "Failed to load or save cues.",
    });
  }
};

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
  } finally {
    await sql.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_ID]);
  }
}

function normalizeCueList(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => normalizeCue(item, index))
    .filter(Boolean);
}

function normalizeCue(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const title = typeof item.title === "string"
    ? item.title.trim().slice(0, 60)
    : "";
  const seconds = Number(item.seconds);

  if (!title || !Number.isInteger(seconds) || seconds < 0) {
    return null;
  }

  return {
    id: normalizeCueId(item.id, index),
    title,
    bpm: normalizeBpm(item.bpm),
    seconds,
    acousticTuning: normalizeTuning(ACOUSTIC_TUNING_FIELD, item.acousticTuning),
    electricTuning: normalizeTuning(ELECTRIC_TUNING_FIELD, item.electricTuning),
    bassTuning: normalizeTuning(BASS_TUNING_FIELD, item.bassTuning),
  };
}

function normalizeCueId(value, index) {
  if (typeof value !== "string") {
    return `cue-${index + 1}`;
  }

  const normalized = value.trim();

  if (!normalized) {
    return `cue-${index + 1}`;
  }

  return normalized.slice(0, 120);
}

function normalizeBpm(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\D/g, "").slice(0, 3);
}

function normalizeTuning(field, value) {
  if (typeof value !== "string") {
    return TUNING_STANDARD;
  }

  const normalized = value.trim().toLowerCase();

  if (
    field === BASS_TUNING_FIELD &&
    (
      normalized === TUNING_D_DROP ||
      normalized === "d 드랍" ||
      normalized === "d드랍"
    )
  ) {
    return TUNING_D_DROP;
  }

  if (
    field !== ELECTRIC_TUNING_FIELD &&
    (
      normalized === TUNING_INACTIVE ||
      normalized === "참여 안함" ||
      normalized === "미참여"
    )
  ) {
    return TUNING_INACTIVE;
  }

  if (normalized === TUNING_HALF_DOWN || normalized === "하프다운") {
    return TUNING_HALF_DOWN;
  }

  return TUNING_STANDARD;
}
