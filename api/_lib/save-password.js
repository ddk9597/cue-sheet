const DEFAULT_SAVE_PASSWORD = "027619";
const MAX_SAVE_PASSWORD_ATTEMPTS = 5;

function getSavePassword() {
  return String(process.env.SAVE_PASSWORD || DEFAULT_SAVE_PASSWORD);
}

function isSavePasswordValid(password) {
  return String(password || "") === getSavePassword();
}

function getClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const realIp = request.headers["x-real-ip"];
  const rawValue = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor || realIp || request.socket?.remoteAddress || "";

  return String(rawValue)
    .split(",")[0]
    .trim() || "unknown";
}

async function validateSavePassword(sql, request, password) {
  const clientIp = getClientIp(request);
  const submittedPassword = String(password || "");

  if (isSavePasswordValid(submittedPassword)) {
    await clearFailedAttempts(sql, clientIp);
    return {
      ok: true,
      ip: clientIp,
    };
  }

  const attempts = await registerFailedAttempt(sql, clientIp);

  if (attempts >= MAX_SAVE_PASSWORD_ATTEMPTS) {
    await clearFailedAttempts(sql, clientIp);
    return {
      ok: false,
      ip: clientIp,
      attempts: MAX_SAVE_PASSWORD_ATTEMPTS,
      maxAttempts: MAX_SAVE_PASSWORD_ATTEMPTS,
      reset: true,
      message: "아 하지 마세요!!!",
    };
  }

  return {
    ok: false,
    ip: clientIp,
    attempts,
    maxAttempts: MAX_SAVE_PASSWORD_ATTEMPTS,
    reset: false,
    message: `비밀번호 오류 (${attempts}/${MAX_SAVE_PASSWORD_ATTEMPTS}, ip: ${clientIp})`,
  };
}

async function registerFailedAttempt(sql, clientIp) {
  const rows = await sql.query(
    [
      "INSERT INTO save_password_attempts (ip_address, failure_count, updated_at)",
      "VALUES ($1, 1, NOW())",
      "ON CONFLICT (ip_address)",
      "DO UPDATE SET",
      "failure_count = save_password_attempts.failure_count + 1,",
      "updated_at = NOW()",
      "RETURNING failure_count",
    ].join(" "),
    [clientIp],
  );

  return Number(rows[0]?.failure_count) || 1;
}

async function clearFailedAttempts(sql, clientIp) {
  await sql.query("DELETE FROM save_password_attempts WHERE ip_address = $1", [clientIp]);
}

module.exports = {
  getClientIp,
  isSavePasswordValid,
  validateSavePassword,
};
