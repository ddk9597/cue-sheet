const { issueLoginCode } = require("../_lib/auth");
const { getSql, ensureSchema } = require("../_lib/db");
const { EmailConfigError, isEmailAuthConfigured, sendLoginCodeEmail } = require("../_lib/email");
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

  if (!isEmailAuthConfigured()) {
    sendJson(response, 503, {
      error: "email_auth_not_configured",
      message: "RESEND_API_KEY와 AUTH_EMAIL_FROM 설정이 필요합니다.",
    });
    return;
  }

  try {
    await ensureSchema(sql);
    const payload = await readJsonBody(request);
    const loginCode = await issueLoginCode(sql, payload.email);

    await sendLoginCodeEmail(loginCode);

    sendJson(response, 200, {
      ok: true,
      email: loginCode.email,
      expiresMinutes: loginCode.expiresMinutes,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "invalid_json",
        message: "잘못된 요청 형식입니다.",
      });
      return;
    }

    if (error instanceof EmailConfigError) {
      sendJson(response, 503, {
        error: "email_auth_not_configured",
        message: error.message,
      });
      return;
    }

    if (error.statusCode) {
      sendJson(response, error.statusCode, {
        error: "request_code_failed",
        message: error.message,
      });
      return;
    }

    console.error("request code error", error);
    sendJson(response, 500, {
      error: "request_code_failed",
      message: "인증코드 발송에 실패했습니다.",
    });
  }
};
