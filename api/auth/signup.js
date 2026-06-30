const {
  getSessionUser,
  updateEmailUserSignup,
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
    const sessionUser = await getSessionUser(sql, request);

    if (!sessionUser) {
      sendJson(response, 401, {
        error: "not_authenticated",
        message: "이메일 인증을 먼저 완료해 주세요.",
      });
      return;
    }

    const payload = await readJsonBody(request);

    if (String(payload.email || "").trim().toLowerCase() !== sessionUser.email) {
      sendJson(response, 403, {
        error: "email_mismatch",
        message: "인증된 이메일과 가입 이메일이 다릅니다.",
      });
      return;
    }

    const user = await updateEmailUserSignup(sql, sessionUser.id, payload);

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
      console.error("signup error", error);
    }

    sendJson(response, statusCode, {
      error: "signup_failed",
      message: error.message || "가입 정보를 저장하지 못했습니다.",
    });
  }
};
