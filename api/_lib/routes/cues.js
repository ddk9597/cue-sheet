const { normalizeCueList } = require("../cues");
const { LEGACY_STORAGE_ROW_ID, ensureSchema, getSql } = require("../db");
const { validateSavePassword } = require("../save-password");
const { getSessionUser } = require("../auth");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");

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
      authenticated: false,
      userScoped: false,
      userId: null,
    });
    return;
  }

  let sessionUser = null;

  try {
    await ensureSchema(sql);
    sessionUser = await getSessionUser(sql, request);

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
          userId: String(sessionUser.id),
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
          authenticated: false,
          userScoped: false,
          userId: null,
        });
        return;
      }

      sendJson(response, 200, {
        items: legacyItems,
        updatedAt: legacyRow?.updated_at ?? null,
        authenticated: false,
        userScoped: false,
        userId: null,
      });
      return;
    }

    const payload = await readJsonBody(request);

    if (sessionUser) {
      if (typeof payload?.expectedUserId !== "string"
        || payload.expectedUserId !== String(sessionUser.id)) {
        sendJson(response, 409, {
          error: "session_changed",
          message: "로그인 계정이 변경되었습니다. 목록을 다시 불러온 뒤 저장해 주세요.",
          authenticated: true,
          userScoped: true,
          userId: String(sessionUser.id),
        });
        return;
      }
    }

    if (!Array.isArray(payload?.items)) {
      sendJson(response, 400, {
        error: "invalid_cue_items",
        message: "저장할 큐시트 목록 형식이 올바르지 않습니다.",
        ...getCueScope(sessionUser),
      });
      return;
    }

    const items = normalizeCueList(payload.items);

    if (items.length !== payload.items.length) {
      sendJson(response, 400, {
        error: "invalid_cue_items",
        message: "저장할 큐시트 항목에 올바르지 않은 값이 있습니다.",
        ...getCueScope(sessionUser),
      });
      return;
    }

    if (sessionUser) {
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
        userId: String(sessionUser.id),
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
        authenticated: false,
        userScoped: false,
        userId: null,
      });
      return;
    }

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
      authenticated: false,
      userScoped: false,
      userId: null,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "invalid_json",
        message: "잘못된 요청 형식입니다.",
        ...getCueScope(sessionUser),
      });
      return;
    }

    console.error("cue api error", error);
    sendJson(response, 500, {
      error: "database_error",
      message: "Failed to load or save cues.",
      ...getCueScope(sessionUser),
    });
  }
};

function getCueScope(sessionUser) {
  if (sessionUser) {
    return {
      authenticated: true,
      userScoped: true,
      userId: String(sessionUser.id),
    };
  }

  return {
    authenticated: false,
    userScoped: false,
    userId: null,
  };
}
