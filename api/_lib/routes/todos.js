const { TODO_DOCUMENT_ROW_ID, ensureSchema, getSql } = require("../db");
const { getSessionUser } = require("../auth");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const { validateSavePassword } = require("../save-password");
const { normalizeTodoHtml } = require("../todo");

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
        const rows = await sql.query(
          "SELECT html, updated_at FROM user_todo_document_state WHERE user_id = $1 LIMIT 1",
          [sessionUser.id],
        );
        const row = rows[0];

        sendJson(response, 200, {
          html: normalizeTodoHtml(row?.html),
          updatedAt: row?.updated_at ?? null,
          authenticated: true,
          userScoped: true,
        });
        return;
      }

      const rows = await sql.query(
        "SELECT html, updated_at FROM todo_document_state WHERE id = $1 LIMIT 1",
        [TODO_DOCUMENT_ROW_ID],
      );
      const row = rows[0];

      sendJson(response, 200, {
        html: normalizeTodoHtml(row?.html),
        updatedAt: row?.updated_at ?? null,
      });
      return;
    }

    const payload = await readJsonBody(request);

    if (sessionUser) {
      const html = normalizeTodoHtml(payload.html);
      const rows = await sql.query(
        [
          "INSERT INTO user_todo_document_state (user_id, html, updated_at)",
          "VALUES ($1, $2, NOW())",
          "ON CONFLICT (user_id)",
          "DO UPDATE SET html = EXCLUDED.html, updated_at = NOW()",
          "RETURNING updated_at",
        ].join(" "),
        [sessionUser.id, html],
      );

      sendJson(response, 200, {
        html,
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

    const html = normalizeTodoHtml(payload.html);
    const rows = await sql.query(
      [
        "INSERT INTO todo_document_state (id, html, updated_at)",
        "VALUES ($1, $2, NOW())",
        "ON CONFLICT (id)",
        "DO UPDATE SET html = EXCLUDED.html, updated_at = NOW()",
        "RETURNING updated_at",
      ].join(" "),
      [TODO_DOCUMENT_ROW_ID, html],
    );

    sendJson(response, 200, {
      html,
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

    console.error("todo api error", error);
    sendJson(response, 500, {
      error: "database_error",
      message: "Failed to load or save todo document.",
    });
  }
};
