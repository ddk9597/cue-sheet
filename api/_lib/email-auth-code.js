const crypto = require("node:crypto");

const DEFAULT_CODE_TTL_MINUTES = 10;
const DEFAULT_MAX_CODE_ATTEMPTS = 5;

function getEmailAuthCodeTtlMinutes() {
  return Math.max(1, Number(process.env.EMAIL_AUTH_CODE_TTL_MINUTES) || DEFAULT_CODE_TTL_MINUTES);
}

function getEmailAuthCodeMaxAttempts() {
  return Math.max(1, Number(process.env.EMAIL_AUTH_CODE_MAX_ATTEMPTS) || DEFAULT_MAX_CODE_ATTEMPTS);
}

function createEmailAuthCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashEmailAuthCode(email, code) {
  return crypto
    .createHmac("sha256", getAuthCodeSecret())
    .update(`${String(email || "").trim().toLowerCase()}:${String(code || "").trim()}`)
    .digest("hex");
}

function getAuthCodeSecret() {
  return String(
    process.env.AUTH_CODE_SECRET
      || process.env.SAVE_PASSWORD
      || process.env.DATABASE_URL
      || process.env.POSTGRES_URL
      || "cue-sheet-email-auth-code",
  );
}

module.exports = {
  createEmailAuthCode,
  getEmailAuthCodeMaxAttempts,
  getEmailAuthCodeTtlMinutes,
  hashEmailAuthCode,
};
