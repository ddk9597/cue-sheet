const {
  authenticateEmailPassword,
  createSession,
} = require("../_lib/auth");
const { ensureSchema, getSql } = require("../_lib/db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../_lib/http");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  const sql = getSql();

  if (!sql) {
    sendJson(response, 503, {
      error: "database_not_configured",
      message: "DB 연결이 아직 설정되지 않았습니다.",
    });
    return;
  }

  try {
    await ensureSchema(sql);
    const payload = await readJsonBody(request);
    const user = await authenticateEmailPassword(sql, payload.email, payload.password);

    await createSession(sql, request, response, user.id);

    sendJson(response, 200, {
      authenticated: true,
      email: user.email,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "invalid_json",
        message: "잘못된 요청 형식입니다.",
      });
      return;
    }

    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      console.error("email login error", error);
    }

    sendJson(response, statusCode, {
      error: "email_login_failed",
      message: error.message || "로그인하지 못했습니다.",
    });
  }
};
