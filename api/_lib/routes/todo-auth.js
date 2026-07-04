const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const { validateSavePassword } = require("../save-password");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const sql = getSql();

    if (!sql) {
      sendJson(response, 503, {
        error: "database_not_configured",
        message: "DATABASE_URL or POSTGRES_URL is required.",
      });
      return;
    }

    await ensureSchema(sql);

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

    sendJson(response, 200, {
      ok: true,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "invalid_json",
        message: "잘못된 요청 형식입니다.",
      });
      return;
    }

    console.error("todo auth api error", error);
    sendJson(response, 500, {
      error: "todo_auth_error",
      message: "비밀번호 확인을 완료하지 못했습니다.",
    });
  }
};
