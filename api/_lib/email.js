const RESEND_EMAILS_URL = "https://api.resend.com/emails";

class EmailConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailConfigError";
  }
}

function isEmailAuthConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM);
}

async function sendLoginCodeEmail({ email, code, expiresMinutes }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new EmailConfigError("RESEND_API_KEY and AUTH_EMAIL_FROM are required.");
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "[Cue Sheet] 이메일 로그인 인증코드",
      html: buildHtmlTemplate(code, expiresMinutes),
      text: buildTextTemplate(code, expiresMinutes),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }
}

function buildHtmlTemplate(code, expiresMinutes) {
  return [
    "<div style=\"font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;line-height:1.6;color:#182019;\">",
    "<h1 style=\"font-size:22px;margin:0 0 12px;\">Cue Sheet 로그인 인증코드</h1>",
    `<p style="margin:0 0 12px;">아래 6자리 코드를 입력하면 로그인됩니다. 유효시간은 ${expiresMinutes}분입니다.</p>`,
    `<div style="display:inline-block;padding:14px 18px;border-radius:12px;background:#182019;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:0.16em;">${escapeHtml(code)}</div>`,
    "<p style=\"margin:16px 0 0;color:#556157;\">본인이 요청하지 않았다면 이 메일을 무시해도 됩니다.</p>",
    "</div>",
  ].join("");
}

function buildTextTemplate(code, expiresMinutes) {
  return [
    "Cue Sheet 로그인 인증코드",
    "",
    `${code}`,
    "",
    `유효시간: ${expiresMinutes}분`,
    "본인이 요청하지 않았다면 이 메일을 무시해도 됩니다.",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = {
  EmailConfigError,
  isEmailAuthConfigured,
  sendLoginCodeEmail,
};
