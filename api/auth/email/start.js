const { normalizeEmail, isValidEmail } = require("../../_lib/auth");
const { ensureSchema, getSql } = require("../../_lib/db");
const {
  createEmailAuthCode,
  getEmailAuthCodeTtlMinutes,
  hashEmailAuthCode,
} = require("../../_lib/email-auth-code");
const { isEmailAuthConfigured, sendEmailAuthCode } = require("../../_lib/email");
const { methodNotAllowed, readJsonBody, sendJson } = require("../../_lib/http");

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
      message: "SMTP 설정이 필요합니다.",
    });
    return;
  }

  try {
    await ensureSchema(sql);
    const payload = await readJsonBody(request);
    const email = normalizeEmail(payload.email);

    if (!isValidEmail(email)) {
      sendJson(response, 400, {
        error: "invalid_email",
        message: "이메일 주소를 확인해 주세요.",
      });
      return;
    }

    await cleanupEmailAuthChallenges(sql);

    const code = createEmailAuthCode();
    const codeHash = hashEmailAuthCode(email, code);
    const ttlMinutes = getEmailAuthCodeTtlMinutes();

    await sql.query(
      "UPDATE email_auth_challenges SET consumed_at = NOW() WHERE email = $1 AND consumed_at IS NULL",
      [email],
    );
    await sql.query(
      [
        "INSERT INTO email_auth_challenges (email, code_hash, expires_at)",
        "VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))",
      ].join(" "),
      [email, codeHash, ttlMinutes],
    );

    await sendEmailAuthCode(email, code);

    sendJson(response, 200, {
      ok: true,
      email,
      ttlMinutes,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "invalid_json",
        message: "잘못된 요청 형식입니다.",
      });
      return;
    }

    console.error("email auth start error", error);
    sendJson(response, error.statusCode || 500, {
      error: "email_auth_start_failed",
      message: error.message || "인증코드를 보내지 못했습니다.",
    });
  }
};

async function cleanupEmailAuthChallenges(sql) {
  await sql.query([
    "DELETE FROM email_auth_challenges",
    "WHERE expires_at <= NOW() - INTERVAL '1 hour'",
    "OR consumed_at <= NOW() - INTERVAL '1 hour'",
  ].join(" "));
}
