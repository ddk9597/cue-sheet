const crypto = require("node:crypto");

const SESSION_COOKIE_NAME = "cue_sheet_session";
const AUTH_SESSION_DAYS = Math.max(1, Number(process.env.AUTH_SESSION_DAYS) || 30);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

async function cleanupExpiredAuthRows(sql) {
  await sql.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
}

async function findOrCreateUser(sql, googleUser) {
  const normalizedEmail = normalizeEmail(googleUser?.email);
  const googleSub = String(googleUser?.googleSub || "").trim();
  const name = String(googleUser?.name || "").trim();
  const pictureUrl = String(googleUser?.pictureUrl || "").trim();

  if (!normalizedEmail || !googleSub) {
    const error = new Error("Google 계정 정보를 확인할 수 없습니다.");
    error.statusCode = 401;
    throw error;
  }

  const googleRows = await sql.query(
    "SELECT id, email, google_sub FROM app_users WHERE google_sub = $1 LIMIT 1",
    [googleSub],
  );

  if (googleRows[0]) {
    await sql.query(
      [
        "UPDATE app_users",
        "SET email = $2, name = $3, picture_url = $4, last_login_at = NOW()",
        "WHERE id = $1",
      ].join(" "),
      [googleRows[0].id, normalizedEmail, name, pictureUrl],
    );
    return {
      id: googleRows[0].id,
      email: normalizedEmail,
    };
  }

  const existingRows = await sql.query(
    "SELECT id, email, google_sub FROM app_users WHERE email = $1 LIMIT 1",
    [normalizedEmail],
  );

  if (existingRows[0]) {
    if (existingRows[0].google_sub && existingRows[0].google_sub !== googleSub) {
      const error = new Error("이미 다른 Google 계정으로 연결된 이메일입니다.");
      error.statusCode = 409;
      throw error;
    }

    await sql.query(
      [
        "UPDATE app_users",
        "SET google_sub = $2, name = $3, picture_url = $4, last_login_at = NOW()",
        "WHERE id = $1",
      ].join(" "),
      [existingRows[0].id, googleSub, name, pictureUrl],
    );
    return {
      id: existingRows[0].id,
      email: existingRows[0].email,
    };
  }

  const insertedRows = await sql.query(
    [
      "INSERT INTO app_users (email, google_sub, name, picture_url, last_login_at)",
      "VALUES ($1, $2, $3, $4, NOW())",
      "RETURNING id, email",
    ].join(" "),
    [normalizedEmail, googleSub, name, pictureUrl],
  );

  return insertedRows[0];
}

async function findOrCreateEmailUser(sql, email) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    const error = new Error("이메일 주소를 확인해 주세요.");

    error.statusCode = 400;
    throw error;
  }

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
  findOrCreateEmailUser,
  findOrCreateUser,
  getSessionUser,
  isValidEmail,
  normalizeEmail,
};
