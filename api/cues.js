const { normalizeCueList } = require("./_lib/cues");
const { LEGACY_STORAGE_ROW_ID, ensureSchema, getSql } = require("./_lib/db");
const { validateSavePassword } = require("./_lib/save-password");
const { getSessionUser } = require("./_lib/auth");
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

    if (request.method === "GET") {
      if (sessionUser) {
        const userRows = await sql.query(
          "SELECT items, updated_at FROM user_cue_sheet_state WHERE user_id = $1 LIMIT 1",
          [sessionUser.id],
        );
        const userRow = userRows[0];

        sendJson(response, 200, {
          items: normalizeCueList(userRow?.items),
          updatedAt: userRow?.updated_at ?? null,
          authenticated: true,
          userScoped: true,
        });
        return;
      }

      const legacyRows = await sql.query(
        "SELECT items, updated_at FROM cue_sheet_state WHERE id = $1 LIMIT 1",
        [LEGACY_STORAGE_ROW_ID],
      );
      const legacyRow = legacyRows[0];
      const legacyItems = normalizeCueList(legacyRow?.items);

      if (legacyRow && legacyItems.length) {
        sendJson(response, 200, {
          items: legacyItems,
          updatedAt: legacyRow.updated_at ?? null,
        });
        return;
      }

      sendJson(response, 200, {
        items: legacyItems,
        updatedAt: legacyRow?.updated_at ?? null,
        authenticated: false,
        userScoped: false,
      });
      return;
    }

    const payload = await readJsonBody(request);

    if (sessionUser) {
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
        authenticated: true,
        userScoped: true,
      });
      return;
    }

    const passwordResult = await validateSavePassword(sql, request, payload.password);

    if (!passwordResult.ok) {
      sendJson(response, passwordResult.reset ? 429 : 401, {
        error: "invalid_save_password",
        message: passwordResult.message,
        attempts: passwordResult.attempts,
        maxAttempts: passwordResult.maxAttempts,
        ip: passwordResult.ip,
        reset: passwordResult.reset,
      });
      return;
    }

    const items = normalizeCueList(payload.items);
    const rows = await sql.query(
      [
        "INSERT INTO cue_sheet_state (id, items, updated_at)",
        "VALUES ($1, $2::jsonb, NOW())",
        "ON CONFLICT (id)",
        "DO UPDATE SET items = EXCLUDED.items, updated_at = NOW()",
        "RETURNING updated_at",
      ].join(" "),
      [LEGACY_STORAGE_ROW_ID, JSON.stringify(items)],
    );

    sendJson(response, 200, {
      items,
      updatedAt: rows[0]?.updated_at ?? null,
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
