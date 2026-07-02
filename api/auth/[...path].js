const {
  authenticateEmailPassword,
  createSession,
  destroySession,
  findOrCreateEmailUser,
  findOrCreateUser,
  getSessionUser,
  normalizeEmail,
  isValidEmail,
  updateEmailUserSignup,
} = require("../_lib/auth");
const { ensureSchema, getSql } = require("../_lib/db");
const {
  createEmailAuthCode,
  getEmailAuthCodeMaxAttempts,
  getEmailAuthCodeTtlMinutes,
  hashEmailAuthCode,
} = require("../_lib/email-auth-code");
const { isEmailAuthConfigured, sendEmailAuthCode } = require("../_lib/email");
const {
  GoogleAuthConfigError,
  getGoogleClientId,
  isGoogleAuthConfigured,
  verifyGoogleCredential,
} = require("../_lib/google-auth");
const { methodNotAllowed, readJsonBody, sendJson } = require("../_lib/http");

module.exports = async (request, response) => {
  const route = getAuthRoute(request);

  if (route === "session") {
    await handleSession(request, response);
    return;
  }

  if (route === "google") {
    await handleGoogle(request, response);
    return;
  }

  if (route === "login") {
    await handleLogin(request, response);
    return;
  }

  if (route === "logout") {
    await handleLogout(request, response);
    return;
  }

  if (route === "signup") {
    await handleSignup(request, response);
    return;
  }

  if (route === "email/start") {
    await handleEmailStart(request, response);
    return;
  }

  if (route === "email/verify") {
    await handleEmailVerify(request, response);
    return;
  }

  sendJson(response, 404, {
    error: "auth_route_not_found",
    message: "인증 API 경로를 찾을 수 없습니다.",
  });
};

function getAuthRoute(request) {
  const queryPath = request.query?.path;

  if (Array.isArray(queryPath)) {
    return queryPath.join("/");
  }

  if (typeof queryPath === "string" && queryPath) {
    return queryPath;
  }

  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);

  return url.pathname
    .replace(/^\/api\/auth\/?/, "")
    .replace(/\/$/, "");
}

async function handleSession(request, response) {
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
}

async function handleGoogle(request, response) {
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
}

async function handleLogin(request, response) {
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
}

async function handleLogout(request, response) {
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
}

async function handleSignup(request, response) {
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
}

async function handleEmailStart(request, response) {
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
}

async function handleEmailVerify(request, response) {
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
}

async function cleanupEmailAuthChallenges(sql) {
  await sql.query([
    "DELETE FROM email_auth_challenges",
    "WHERE expires_at <= NOW() - INTERVAL '1 hour'",
    "OR consumed_at <= NOW() - INTERVAL '1 hour'",
  ].join(" "));
}
