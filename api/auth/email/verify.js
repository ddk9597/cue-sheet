const {
  createSession,
  findOrCreateEmailUser,
  normalizeEmail,
  isValidEmail,
} = require("../../_lib/auth");
const { ensureSchema, getSql } = require("../../_lib/db");
const {
  getEmailAuthCodeMaxAttempts,
  hashEmailAuthCode,
} = require("../../_lib/email-auth-code");
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

  try {
    await ensureSchema(sql);
    const payload = await readJsonBody(request);
    const email = normalizeEmail(payload.email);
    const code = String(payload.code || "").replace(/\D/g, "").slice(0, 6);

    if (!isValidEmail(email) || code.length !== 6) {
      sendJson(response, 400, {
        error: "invalid_email_code",
        message: "이메일과 인증코드를 확인해 주세요.",
      });
      return;
    }

    const rows = await sql.query(
      [
        "SELECT id, code_hash, attempts, expires_at",
        "FROM email_auth_challenges",
        "WHERE email = $1 AND consumed_at IS NULL",
        "ORDER BY created_at DESC",
        "LIMIT 1",
      ].join(" "),
      [email],
    );
    const challenge = rows[0];

    if (!challenge) {
      sendJson(response, 401, {
        error: "missing_email_challenge",
        message: "인증코드를 다시 요청해 주세요.",
      });
      return;
    }

    if (new Date(challenge.expires_at).getTime() <= Date.now()) {
      await sql.query(
        "UPDATE email_auth_challenges SET consumed_at = NOW() WHERE id = $1",
        [challenge.id],
      );
      sendJson(response, 401, {
        error: "expired_email_challenge",
        message: "인증코드가 만료되었습니다. 다시 요청해 주세요.",
      });
      return;
    }

    const expectedHash = hashEmailAuthCode(email, code);

    if (challenge.code_hash !== expectedHash) {
      const attempts = Number(challenge.attempts) + 1;
      const maxAttempts = getEmailAuthCodeMaxAttempts();

      if (attempts >= maxAttempts) {
        await sql.query(
          "UPDATE email_auth_challenges SET attempts = $2, consumed_at = NOW() WHERE id = $1",
          [challenge.id, attempts],
        );
        sendJson(response, 429, {
          error: "email_code_attempts_exceeded",
          message: "인증코드를 다시 요청해 주세요.",
        });
        return;
      }

      await sql.query(
        "UPDATE email_auth_challenges SET attempts = $2 WHERE id = $1",
        [challenge.id, attempts],
      );
      sendJson(response, 401, {
        error: "invalid_email_code",
        message: `인증코드가 맞지 않습니다. (${attempts}/${maxAttempts})`,
      });
      return;
    }

    await sql.query(
      "UPDATE email_auth_challenges SET consumed_at = NOW() WHERE id = $1",
      [challenge.id],
    );
    const user = await findOrCreateEmailUser(sql, email);

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

    console.error("email auth verify error", error);
    sendJson(response, error.statusCode || 500, {
      error: "email_auth_verify_failed",
      message: error.message || "이메일 인증을 완료하지 못했습니다.",
    });
  }
};
