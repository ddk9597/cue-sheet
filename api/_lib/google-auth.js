const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client();

class GoogleAuthConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "GoogleAuthConfigError";
  }
}

function getGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

function isGoogleAuthConfigured() {
  return Boolean(getGoogleClientId());
}

async function verifyGoogleCredential(credential) {
  const clientId = getGoogleClientId();

  if (!clientId) {
    throw new GoogleAuthConfigError("GOOGLE_CLIENT_ID is required.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: String(credential || ""),
    audience: clientId,
  });
  const payload = ticket.getPayload();
  const email = String(payload?.email || "").trim().toLowerCase();

  if (!email || payload?.email_verified !== true) {
    const error = new Error("Google 계정 이메일을 확인할 수 없습니다.");
    error.statusCode = 401;
    throw error;
  }

  return {
    email,
  };
}

module.exports = {
  GoogleAuthConfigError,
  getGoogleClientId,
  isGoogleAuthConfigured,
  verifyGoogleCredential,
};
