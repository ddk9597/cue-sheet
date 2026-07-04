const { PRACTICE_LOG_ROW_ID, ensureSchema, getSql } = require("../db");
const { getSessionUser } = require("../auth");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const { normalizePracticeLogs } = require("../practice");
const { validateSavePassword } = require("../save-password");

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
          "SELECT logs, updated_at FROM user_practice_calendar_state WHERE user_id = $1 LIMIT 1",
          [sessionUser.id],
        );
        const userRow = userRows[0];

        sendJson(response, 200, {
          logs: normalizePracticeLogs(userRow?.logs),
          updatedAt: userRow?.updated_at ?? null,
          authenticated: true,
          userScoped: true,
        });
        return;
      }

      const rows = await sql.query(
        "SELECT logs, updated_at FROM practice_calendar_state WHERE id = $1 LIMIT 1",
        [PRACTICE_LOG_ROW_ID],
      );
      const row = rows[0];

      sendJson(response, 200, {
        logs: normalizePracticeLogs(row?.logs),
        updatedAt: row?.updated_at ?? null,
      });
      return;
    }

    const payload = await readJsonBody(request);

    if (sessionUser) {
      const logs = normalizePracticeLogs(payload.logs);
      const rows = await sql.query(
        [
          "INSERT INTO user_practice_calendar_state (user_id, logs, updated_at)",
          "VALUES ($1, $2::jsonb, NOW())",
          "ON CONFLICT (user_id)",
          "DO UPDATE SET logs = EXCLUDED.logs, updated_at = NOW()",
          "RETURNING updated_at",
        ].join(" "),
        [sessionUser.id, JSON.stringify(logs)],
      );

      sendJson(response, 200, {
        logs,
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

    const logs = normalizePracticeLogs(payload.logs);
    const rows = await sql.query(
      [
        "INSERT INTO practice_calendar_state (id, logs, updated_at)",
        "VALUES ($1, $2::jsonb, NOW())",
        "ON CONFLICT (id)",
        "DO UPDATE SET logs = EXCLUDED.logs, updated_at = NOW()",
        "RETURNING updated_at",
      ].join(" "),
      [PRACTICE_LOG_ROW_ID, JSON.stringify(logs)],
    );

    sendJson(response, 200, {
      logs,
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

    console.error("practice api error", error);
    sendJson(response, 500, {
      error: "database_error",
      message: "Failed to load or save practice logs.",
    });
  }
};
