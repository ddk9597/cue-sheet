const { getSql, ensureSchema } = require("../_lib/db");
const { getGoogleClientId, isGoogleAuthConfigured } = require("../_lib/google-auth");
const { getSessionUser } = require("../_lib/auth");
const { methodNotAllowed, sendJson } = require("../_lib/http");

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const sql = getSql();

  if (!sql) {
    sendJson(response, 200, {
      authenticated: false,
      email: null,
      databaseConfigured: false,
      googleLoginConfigured: false,
      emailLoginConfigured: false,
      googleClientId: "",
    });
    return;
  }

  try {
    await ensureSchema(sql);
    const sessionUser = await getSessionUser(sql, request);

    sendJson(response, 200, {
      authenticated: Boolean(sessionUser),
      email: sessionUser?.email ?? null,
      databaseConfigured: true,
      googleLoginConfigured: isGoogleAuthConfigured(),
      emailLoginConfigured: true,
      googleClientId: getGoogleClientId(),
    });
  } catch (error) {
    console.error("auth session error", error);
    sendJson(response, 500, {
      error: "auth_session_error",
      message: "로그인 상태를 확인하지 못했습니다.",
      authenticated: false,
      email: null,
      databaseConfigured: true,
      googleLoginConfigured: isGoogleAuthConfigured(),
      emailLoginConfigured: true,
      googleClientId: getGoogleClientId(),
    });
  }
};
