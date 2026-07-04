const { normalizeCueList } = require("../cues");
const { LEGACY_STORAGE_ROW_ID, ensureSchema, getSql } = require("../db");
const { methodNotAllowed, sendJson } = require("../http");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const sql = getSql();

  if (!sql) {
    sendJson(response, 503, {
      error: "database_not_configured",
      message: "DATABASE_URL or POSTGRES_URL is required.",
    });
    return;
  }

  try {
    await ensureSchema(sql);

    const rows = await sql.query(
      "SELECT items, updated_at FROM cue_sheet_state WHERE id = $1 LIMIT 1",
      [LEGACY_STORAGE_ROW_ID],
    );
    const row = rows[0];

    sendJson(response, 200, {
      items: normalizeCueList(row?.items),
      updatedAt: row?.updated_at ?? null,
    });
  } catch (error) {
    console.error("audience cue api error", error);
    sendJson(response, 500, {
      error: "database_error",
      message: "Failed to load audience cues.",
    });
  }
};
