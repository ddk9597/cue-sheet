const { destroySession } = require("../_lib/auth");
const { getSql, ensureSchema } = require("../_lib/db");
const { methodNotAllowed, sendJson } = require("../_lib/http");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    methodNotAllowed(response, ["POST"]);
    return;
  }

  const sql = getSql();

  if (!sql) {
    sendJson(response, 200, { ok: true });
    return;
  }

  try {
    await ensureSchema(sql);
    await destroySession(sql, request, response);
    sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error("logout error", error);
    sendJson(response, 500, {
      error: "logout_failed",
      message: "로그아웃 처리에 실패했습니다.",
    });
  }
};
