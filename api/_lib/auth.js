const crypto = require("node:crypto");

const SESSION_COOKIE_NAME = "cue_sheet_session";
const AUTH_CODE_TTL_MINUTES = Math.max(1, Number(process.env.AUTH_CODE_TTL_MINUTES) || 10);
const AUTH_SESSION_DAYS = Math.max(1, Number(process.env.AUTH_SESSION_DAYS) || 30);
const AUTH_CODE_REQUEST_INTERVAL_SECONDS = Math.max(
  30,
  Number(process.env.AUTH_CODE_REQUEST_INTERVAL_SECONDS) || 60,
);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function cleanupExpiredAuthRows(sql) {
  await sql.query("DELETE FROM email_login_codes WHERE expires_at <= NOW() OR consumed_at IS NOT NULL");
  await sql.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
}

async function issueLoginCode(sql, email) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    const error = new Error("올바른 이메일 주소를 입력하세요.");
    error.statusCode = 400;
    throw error;
  }

  await cleanupExpiredAuthRows(sql);

  const recentRows = await sql.query(
    [
      "SELECT created_at FROM email_login_codes",
      "WHERE email = $1 AND consumed_at IS NULL AND expires_at > NOW()",
      "ORDER BY created_at DESC LIMIT 1",
    ].join(" "),
    [normalizedEmail],
  );

  const recent = recentRows[0]?.created_at ? new Date(recentRows[0].created_at).getTime() : 0;

  if (recent && Date.now() - recent < AUTH_CODE_REQUEST_INTERVAL_SECONDS * 1000) {
    const error = new Error("잠시 후에 다시 요청하세요.");
    error.statusCode = 429;
    throw error;
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const codeHash = hashValue(`${normalizedEmail}:${code}`);

  await sql.query(
    "UPDATE email_login_codes SET consumed_at = NOW() WHERE email = $1 AND consumed_at IS NULL",
    [normalizedEmail],
  );

  await sql.query(
    [
      "INSERT INTO email_login_codes (email, code_hash, expires_at)",
      "VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))",
    ].join(" "),
    [normalizedEmail, codeHash, AUTH_CODE_TTL_MINUTES],
  );

  return {
    code,
    email: normalizedEmail,
    expiresMinutes: AUTH_CODE_TTL_MINUTES,
  };
}

async function consumeLoginCode(sql, email, code) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code || "").trim();

  if (!isValidEmail(normalizedEmail) || !/^\d{6}$/.test(normalizedCode)) {
    return null;
  }

  await cleanupExpiredAuthRows(sql);

  const codeHash = hashValue(`${normalizedEmail}:${normalizedCode}`);
  const rows = await sql.query(
    [
      "SELECT id FROM email_login_codes",
      "WHERE email = $1 AND code_hash = $2 AND consumed_at IS NULL AND expires_at > NOW()",
      "ORDER BY created_at DESC LIMIT 1",
    ].join(" "),
    [normalizedEmail, codeHash],
  );

  const codeRow = rows[0];

  if (!codeRow) {
    return null;
  }

  const updatedRows = await sql.query(
    [
      "UPDATE email_login_codes SET consumed_at = NOW()",
      "WHERE id = $1 AND consumed_at IS NULL",
      "RETURNING id",
    ].join(" "),
    [codeRow.id],
  );

  if (!updatedRows[0]) {
    return null;
  }

  return normalizedEmail;
}

async function findOrCreateUser(sql, email) {
  const normalizedEmail = normalizeEmail(email);

  const existingRows = await sql.query(
    "SELECT id, email FROM app_users WHERE email = $1 LIMIT 1",
    [normalizedEmail],
  );

  if (existingRows[0]) {
    await sql.query(
      "UPDATE app_users SET last_login_at = NOW() WHERE id = $1",
      [existingRows[0].id],
    );
    return existingRows[0];
  }

  const insertedRows = await sql.query(
    [
      "INSERT INTO app_users (email, last_login_at)",
      "VALUES ($1, NOW())",
      "RETURNING id, email",
    ].join(" "),
    [normalizedEmail],
  );

  return insertedRows[0];
}

async function createSession(sql, request, response, userId) {
  const sessionToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashValue(sessionToken);

  await cleanupExpiredAuthRows(sql);
  await sql.query(
    [
      "INSERT INTO user_sessions (user_id, token_hash, expires_at)",
      "VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 day'))",
    ].join(" "),
    [userId, tokenHash, AUTH_SESSION_DAYS],
  );

  setCookie(response, request, SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    maxAge: AUTH_SESSION_DAYS * 24 * 60 * 60,
    path: "/",
    sameSite: "Lax",
    secure: isSecureRequest(request),
  });
}

async function destroySession(sql, request, response) {
  const sessionToken = readCookie(request, SESSION_COOKIE_NAME);

  if (sessionToken) {
    await sql.query(
      "DELETE FROM user_sessions WHERE token_hash = $1",
      [hashValue(sessionToken)],
    );
  }

  setCookie(response, request, SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "Lax",
    secure: isSecureRequest(request),
  });
}

async function getSessionUser(sql, request) {
  const sessionToken = readCookie(request, SESSION_COOKIE_NAME);

  if (!sessionToken) {
    return null;
  }

  await cleanupExpiredAuthRows(sql);

  const rows = await sql.query(
    [
      "SELECT s.user_id, u.email FROM user_sessions s",
      "JOIN app_users u ON u.id = s.user_id",
      "WHERE s.token_hash = $1 AND s.expires_at > NOW()",
      "LIMIT 1",
    ].join(" "),
    [hashValue(sessionToken)],
  );

  const sessionUser = rows[0];

  if (!sessionUser) {
    return null;
  }

  await sql.query(
    "UPDATE user_sessions SET last_seen_at = NOW() WHERE token_hash = $1",
    [hashValue(sessionToken)],
  );

  return {
    id: sessionUser.user_id,
    email: sessionUser.email,
  };
}

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return "";
  }

  const cookies = cookieHeader.split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const cookie of cookies) {
    const [cookieName, ...valueParts] = cookie.split("=");

    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return "";
}

function setCookie(response, request, name, value, options) {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.expires) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.path) {
    segments.push(`Path=${options.path}`);
  }

  if (options.httpOnly) {
    segments.push("HttpOnly");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push("Secure");
  }

  response.setHeader("Set-Cookie", segments.join("; "));
}

function isSecureRequest(request) {
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "");
  const host = String(request.headers.host || "");

  if (forwardedProto.toLowerCase() === "https") {
    return true;
  }

  return !host.startsWith("localhost") && !host.startsWith("127.0.0.1");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

module.exports = {
  createSession,
  destroySession,
  findOrCreateUser,
  getSessionUser,
  issueLoginCode,
  isValidEmail,
  normalizeEmail,
  consumeLoginCode,
};
