const { consumeLoginCode, createSession, findOrCreateUser } = require("../_lib/auth");
const { getSql, ensureSchema } = require("../_lib/db");
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
    const verifiedEmail = await consumeLoginCode(sql, payload.email, payload.code);

    if (!verifiedEmail) {
      sendJson(response, 401, {
        error: "invalid_code",
        message: "인증코드가 올바르지 않거나 만료되었습니다.",
      });
      return;
    }

    const user = await findOrCreateUser(sql, verifiedEmail);
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

    console.error("verify code error", error);
    sendJson(response, 500, {
      error: "verify_code_failed",
      message: "로그인 처리에 실패했습니다.",
    });
  }
};
