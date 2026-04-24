const { getSessionUser } = require("./_lib/auth");
const { normalizeCueList } = require("./_lib/cues");
const { LEGACY_STORAGE_ROW_ID, ensureSchema, getSql } = require("./_lib/db");
const { methodNotAllowed, readJsonBody, sendJson } = require("./_lib/http");

module.exports = async (request, response) => {
  if (!["GET", "PUT"].includes(request.method)) {
    methodNotAllowed(response, ["GET", "PUT"]);
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
    const sessionUser = await getSessionUser(sql, request);

    if (!sessionUser) {
      sendJson(response, 401, {
        error: "unauthorized",
        message: "이메일 로그인 후 사용할 수 있습니다.",
      });
      return;
    }

    if (request.method === "GET") {
      const rows = await sql.query(
        [
          "SELECT items, updated_at FROM user_cue_sheet_state",
          "WHERE user_id = $1 LIMIT 1",
        ].join(" "),
        [sessionUser.id],
      );
      const row = rows[0];

      if (!row) {
        const legacyRows = await sql.query(
          "SELECT items, updated_at FROM cue_sheet_state WHERE id = $1 LIMIT 1",
          [LEGACY_STORAGE_ROW_ID],
        );
        const legacyRow = legacyRows[0];

        sendJson(response, 200, {
          items: normalizeCueList(legacyRow?.items),
          updatedAt: legacyRow?.updated_at ?? null,
          email: sessionUser.email,
        });
        return;
      }

      sendJson(response, 200, {
        items: normalizeCueList(row.items),
        updatedAt: row.updated_at ?? null,
        email: sessionUser.email,
      });
      return;
    }

    const payload = await readJsonBody(request);
    const items = normalizeCueList(payload.items);
    const rows = await sql.query(
      [
        "INSERT INTO user_cue_sheet_state (user_id, items, updated_at)",
        "VALUES ($1, $2::jsonb, NOW())",
        "ON CONFLICT (user_id)",
        "DO UPDATE SET items = EXCLUDED.items, updated_at = NOW()",
        "RETURNING updated_at",
      ].join(" "),
      [sessionUser.id, JSON.stringify(items)],
    );

    sendJson(response, 200, {
      items,
      updatedAt: rows[0]?.updated_at ?? null,
      email: sessionUser.email,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "invalid_json",
        message: "잘못된 요청 형식입니다.",
      });
      return;
    }

    console.error("cue api error", error);
    sendJson(response, 500, {
      error: "database_error",
      message: "Failed to load or save cues.",
    });
  }
};
