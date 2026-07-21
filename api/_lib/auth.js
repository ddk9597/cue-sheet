const crypto = require("node:crypto");

const SESSION_COOKIE_NAME = "cue_sheet_session";
const AUTH_SESSION_DAYS = Math.max(1, Number(process.env.AUTH_SESSION_DAYS) || 30);
const PASSWORD_HASH_BYTES = 64;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function createEmailAlreadyRegisteredError() {
  const error = new Error("이미 가입된 이메일입니다. 로그인해 주세요.");

  error.code = "email_already_registered";
  error.statusCode = 409;
  return error;
}

function isUserRegistrationComplete(user) {
  return Boolean(
    String(user?.password_hash || "").trim()
      || String(user?.google_sub || "").trim(),
  );
}

async function isEmailRegistered(sql, email) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return false;
  }

  const rows = await sql.query(
    [
      "SELECT id FROM app_users",
      "WHERE email = $1",
      "AND (password_hash <> '' OR COALESCE(google_sub, '') <> '')",
      "LIMIT 1",
    ].join(" "),
    [normalizedEmail],
  );

  return Boolean(rows[0]);
}

async function cleanupExpiredAuthRows(sql) {
  await sql.query("DELETE FROM user_sessions WHERE expires_at <= NOW()");
}

async function findOrCreateUser(sql, googleUser) {
  const normalizedEmail = normalizeEmail(googleUser?.email);
  const googleSub = String(googleUser?.googleSub || "").trim();
  const name = String(googleUser?.name || "").trim();

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
        "SET email = $2, name = $3, last_login_at = NOW()",
        "WHERE id = $1",
      ].join(" "),
      [googleRows[0].id, normalizedEmail, name],
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
        "SET google_sub = $2, name = $3, last_login_at = NOW()",
        "WHERE id = $1",
      ].join(" "),
      [existingRows[0].id, googleSub, name],
    );
    return {
      id: existingRows[0].id,
      email: existingRows[0].email,
    };
  }

  const insertedRows = await sql.query(
    [
      "INSERT INTO app_users (email, google_sub, name, last_login_at)",
      "VALUES ($1, $2, $3, NOW())",
      "RETURNING id, email",
    ].join(" "),
    [normalizedEmail, googleSub, name],
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
    "SELECT id, email, google_sub, password_hash FROM app_users WHERE email = $1 LIMIT 1",
    [normalizedEmail],
  );

  if (existingRows[0]) {
    if (isUserRegistrationComplete(existingRows[0])) {
      throw createEmailAlreadyRegisteredError();
    }

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
      "ON CONFLICT (email) DO NOTHING",
      "RETURNING id, email",
    ].join(" "),
    [normalizedEmail],
  );

  if (insertedRows[0]) {
    return insertedRows[0];
  }

  const conflictedRows = await sql.query(
    "SELECT id, email, google_sub, password_hash FROM app_users WHERE email = $1 LIMIT 1",
    [normalizedEmail],
  );
  const conflictedUser = conflictedRows[0];

  if (!conflictedUser) {
    const error = new Error("회원 정보를 확인하지 못했습니다.");

    error.statusCode = 500;
    throw error;
  }

  if (isUserRegistrationComplete(conflictedUser)) {
    throw createEmailAlreadyRegisteredError();
  }

  await sql.query(
    "UPDATE app_users SET last_login_at = NOW() WHERE id = $1",
    [conflictedUser.id],
  );

  return {
    id: conflictedUser.id,
    email: conflictedUser.email,
  };
}

function isValidPassword(value) {
  const password = String(value || "");

  return password.length >= 8
    && /[A-Za-z]/.test(password)
    && /\d/.test(password);
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, PASSWORD_HASH_BYTES).toString("hex");

  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(String(hash), "hex");
  const actual = crypto.scryptSync(String(password), String(salt), expected.length);

  if (actual.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}

async function updateEmailUserSignup(sql, userId, payload) {
  const email = normalizeEmail(payload.email);
  const name = String(payload.name || "").trim().slice(0, 80);
  const birthDate = String(payload.birthDate || "").trim().slice(0, 20);
  const phone = String(payload.phone || "").replace(/\D/g, "").slice(0, 11);
  const memo = String(payload.memo || "").trim().slice(0, 120);
  const region = normalizeProfileText(payload.region, 40);
  const position = normalizeProfileText(payload.position, 40);
  const genre = normalizeProfileText(payload.genre, 80);
  const password = String(payload.password || "");

  if (!isValidEmail(email)) {
    const error = new Error("이메일 주소를 확인해 주세요.");

    error.statusCode = 400;
    throw error;
  }

  if (!name) {
    const error = new Error("이름을 입력해 주세요.");

    error.statusCode = 400;
    throw error;
  }

  if (!/^010\d{8}$/.test(phone)) {
    const error = new Error("휴대폰번호를 확인해 주세요.");

    error.statusCode = 400;
    throw error;
  }

  if (!isValidPassword(password)) {
    const error = new Error("비밀번호 조건을 확인해 주세요.");

    error.statusCode = 400;
    throw error;
  }

  const passwordRecord = createPasswordRecord(password);
  const rows = await sql.query(
    [
      "UPDATE app_users",
      "SET email = $2, name = $3, birth_date = $4, phone = $5, memo = $6,",
      "region = $7, \"position\" = $8, genre = $9,",
      "password_hash = $10, password_salt = $11, last_login_at = NOW()",
      "WHERE id = $1 AND password_hash = '' AND COALESCE(google_sub, '') = ''",
      "RETURNING id, email",
    ].join(" "),
    [
      userId,
      email,
      name,
      birthDate,
      phone,
      memo,
      region,
      position,
      genre,
      passwordRecord.hash,
      passwordRecord.salt,
    ],
  );

  if (!rows[0]) {
    const existingRows = await sql.query(
      "SELECT id, google_sub, password_hash FROM app_users WHERE id = $1 LIMIT 1",
      [userId],
    );

    if (existingRows[0] && isUserRegistrationComplete(existingRows[0])) {
      throw createEmailAlreadyRegisteredError();
    }

    const error = new Error("회원 정보를 찾을 수 없습니다.");

    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

function normalizeProfileText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function authenticateEmailPassword(sql, email, password) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail) || !String(password || "")) {
    const error = new Error("이메일 또는 비밀번호를 확인해 주세요.");

    error.statusCode = 401;
    throw error;
  }

  const rows = await sql.query(
    [
      "SELECT id, email, password_hash, password_salt",
      "FROM app_users",
      "WHERE email = $1",
      "LIMIT 1",
    ].join(" "),
    [normalizedEmail],
  );
  const user = rows[0];

  if (!user) {
    const error = new Error("이메일 또는 비밀번호를 확인해 주세요.");

    error.statusCode = 401;
    throw error;
  }

  if (!user.password_hash || !user.password_salt) {
    const error = new Error("비밀번호가 아직 등록되지 않았습니다. 회원가입을 다시 완료해 주세요.");

    error.statusCode = 409;
    throw error;
  }

  if (!verifyPassword(password, user.password_salt, user.password_hash)) {
    const error = new Error("이메일 또는 비밀번호를 확인해 주세요.");

    error.statusCode = 401;
    throw error;
  }

  await sql.query(
    "UPDATE app_users SET last_login_at = NOW() WHERE id = $1",
    [user.id],
  );

  return {
    id: user.id,
    email: user.email,
  };
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
  let sessionToken = "";

  try {
    sessionToken = readCookie(request, SESSION_COOKIE_NAME);
  } catch {
    sessionToken = "";
  }

  try {
    if (sessionToken && sql) {
      await sql.query(
        "DELETE FROM user_sessions WHERE token_hash = $1",
        [hashValue(sessionToken)],
      );
    }
  } finally {
    setCookie(response, request, SESSION_COOKIE_NAME, "", {
      expires: new Date(0),
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      secure: isSecureRequest(request),
    });
  }
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
  authenticateEmailPassword,
  createSession,
  destroySession,
  findOrCreateEmailUser,
  findOrCreateUser,
  getSessionUser,
  isEmailRegistered,
  isValidPassword,
  isValidEmail,
  normalizeEmail,
  updateEmailUserSignup,
};
