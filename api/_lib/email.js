const nodemailer = require("nodemailer");

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const secure = String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false";
  const from = String(process.env.SMTP_FROM || user).trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

function isEmailAuthConfigured() {
  const config = getSmtpConfig();

  return Boolean(config.host && config.user && config.pass && config.from);
}

async function sendEmailAuthCode(email, code) {
  const config = getSmtpConfig();

  if (!isEmailAuthConfigured()) {
    const error = new Error("SMTP 설정이 필요합니다.");

    error.statusCode = 503;
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "큐시트 로그인 인증코드",
    text: [
      "큐시트 로그인 인증코드입니다.",
      "",
      code,
      "",
      "이 코드는 잠시 후 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
    ].join("\n"),
    html: [
      "<p>큐시트 로그인 인증코드입니다.</p>",
      `<p style="font-size:24px;font-weight:700;letter-spacing:0.18em;">${escapeHtml(code)}</p>`,
      "<p>이 코드는 잠시 후 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>",
    ].join(""),
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = {
  getSmtpConfig,
  isEmailAuthConfigured,
  sendEmailAuthCode,
};
