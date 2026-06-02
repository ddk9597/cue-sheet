const { createSession, findOrCreateUser } = require("../_lib/auth");
const { getSql, ensureSchema } = require("../_lib/db");
const {
  GoogleAuthConfigError,
  isGoogleAuthConfigured,
  verifyGoogleCredential,
} = require("../_lib/google-auth");
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

  if (!isGoogleAuthConfigured()) {
    sendJson(response, 503, {
      error: "google_auth_not_configured",
      message: "GOOGLE_CLIENT_ID 설정이 필요합니다.",
    });
    return;
  }

  try {
    await ensureSchema(sql);
    const payload = await readJsonBody(request);
    const googleUser = await verifyGoogleCredential(payload.credential);
    const user = await findOrCreateUser(sql, googleUser);

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

    if (error instanceof GoogleAuthConfigError) {
      sendJson(response, 503, {
        error: "google_auth_not_configured",
        message: error.message,
      });
      return;
    }

    if (error.statusCode) {
      sendJson(response, error.statusCode, {
        error: "google_login_failed",
        message: error.message,
      });
      return;
    }

    console.error("google login error", error);
    sendJson(response, 401, {
      error: "google_login_failed",
      message: "Google 로그인 처리에 실패했습니다.",
    });
  }
};
