const AUTH_SESSION_ENDPOINT = "/api/auth/session";
const AUTH_GOOGLE_ENDPOINT = "/api/auth/google";
const AUTH_LOGIN_ENDPOINT = "/api/auth/login";
const AUTH_LOGOUT_ENDPOINT = "/api/auth/logout";
const LOGIN_REDIRECT_HREF = "./workspace.html#memberPanel";

const authTitle = document.querySelector("#authTitle");
const authStatus = document.querySelector("#authStatus");
const googleSignInButton = document.querySelector("#googleSignInButton");
const emailAuthForm = document.querySelector("#emailAuthForm");
const emailAuthInput = document.querySelector("#emailAuthInput");
const emailPasswordInput = document.querySelector("#emailPasswordInput");
const emailLoginButton = document.querySelector("#emailLoginButton");
const authAccount = document.querySelector("#authAccount");
const authEmailLabel = document.querySelector("#authEmailLabel");
const logoutButton = document.querySelector("#logoutButton");

let authSession = {
  authenticated: false,
  email: "",
  databaseConfigured: false,
  googleLoginConfigured: false,
  emailLoginConfigured: false,
  googleClientId: "",
  message: "",
};
let authInFlight = false;
let emailAuthInFlight = false;
let authNotice = "";
let googleButtonRenderedForClientId = "";
let googleButtonRenderRetry = 0;

window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;

emailAuthForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  loginWithEmailPassword();
});

logoutButton?.addEventListener("click", async () => {
  await logoutAuthSession();
});

window.addEventListener("load", () => {
  renderGoogleSignInButton();
});

initializeLoginPage();

async function initializeLoginPage() {
  authSession = await loadAuthSession();
  authNotice = "";
  updateAuthUi();
}

async function loadAuthSession() {
  try {
    const response = await fetch(AUTH_SESSION_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await safeReadJson(response);

    return normalizeAuthSession(payload);
  } catch {
    return {
      authenticated: false,
      email: "",
      databaseConfigured: false,
      googleLoginConfigured: false,
      emailLoginConfigured: false,
      googleClientId: "",
      message: "로그인 상태를 확인하지 못했습니다.",
    };
  }
}

async function loginWithEmailPassword() {
  if (emailAuthInFlight || authSession.authenticated) {
    return;
  }

  const email = normalizeEmail(emailAuthInput?.value || "");
  const password = String(emailPasswordInput?.value || "");

  if (!isValidEmail(email) || !password) {
    authNotice = "이메일과 비밀번호를 입력해 주세요.";
    updateAuthUi();
    (isValidEmail(email) ? emailPasswordInput : emailAuthInput)?.focus();
    return;
  }

  emailAuthInFlight = true;
  authNotice = "로그인하는 중입니다.";
  updateAuthUi();

  try {
    const response = await fetch(AUTH_LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      authNotice = payload.message || "로그인하지 못했습니다.";
      return;
    }

    authSession = normalizeAuthSession({
      ...payload,
      databaseConfigured: true,
      googleLoginConfigured: authSession.googleLoginConfigured,
      emailLoginConfigured: true,
      googleClientId: authSession.googleClientId,
    });
    if (emailPasswordInput) {
      emailPasswordInput.value = "";
    }
    authNotice = "로그인되었습니다. 내 작업 공간으로 이동합니다.";
    updateAuthUi();
    redirectToWorkspace();
  } catch {
    authNotice = "로그인 요청을 완료하지 못했습니다.";
  } finally {
    emailAuthInFlight = false;
    updateAuthUi();
  }
}

async function handleGoogleCredentialResponse(googleResponse) {
  if (authInFlight) {
    return;
  }

  const credential = String(googleResponse?.credential || "");

  if (!credential) {
    authNotice = "Google 로그인 응답을 확인하지 못했습니다.";
    updateAuthUi();
    return;
  }

  authInFlight = true;
  authNotice = "Google 로그인을 확인하는 중입니다.";
  updateAuthUi();

  try {
    const response = await fetch(AUTH_GOOGLE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ credential }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      authNotice = payload.message || "Google 로그인에 실패했습니다.";
      return;
    }

    authSession = normalizeAuthSession({
      ...payload,
      databaseConfigured: true,
      googleLoginConfigured: true,
      emailLoginConfigured: authSession.emailLoginConfigured,
      googleClientId: authSession.googleClientId,
    });
    authNotice = "로그인되었습니다. 내 작업 공간으로 이동합니다.";
    updateAuthUi();
    redirectToWorkspace();
  } catch {
    authNotice = "로그인 처리를 완료하지 못했습니다.";
  } finally {
    authInFlight = false;
    updateAuthUi();
  }
}

async function logoutAuthSession() {
  if (authInFlight) {
    return;
  }

  authInFlight = true;
  authNotice = "로그아웃하는 중입니다.";
  updateAuthUi();

  try {
    await fetch(AUTH_LOGOUT_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });

    authSession = {
      authenticated: false,
      email: "",
      databaseConfigured: authSession.databaseConfigured,
      googleLoginConfigured: authSession.googleLoginConfigured,
      emailLoginConfigured: authSession.emailLoginConfigured,
      googleClientId: authSession.googleClientId,
      message: "",
    };
    authNotice = "로그아웃되었습니다.";
    window.google?.accounts?.id?.disableAutoSelect();
  } catch {
    authNotice = "로그아웃 요청을 완료하지 못했습니다.";
  } finally {
    authInFlight = false;
    updateAuthUi();
  }
}

function updateAuthUi() {
  window.CueSheetAuthNav?.setAuthenticated(authSession.authenticated);

  const googleConfigured = authSession.databaseConfigured && authSession.googleLoginConfigured;

  if (googleSignInButton) {
    googleSignInButton.hidden = authSession.authenticated || !googleConfigured;
  }
  if (emailAuthForm) {
    emailAuthForm.hidden = authSession.authenticated;
  }
  if (emailAuthInput) {
    emailAuthInput.disabled = emailAuthInFlight || authSession.authenticated;
  }
  if (emailPasswordInput) {
    emailPasswordInput.disabled = emailAuthInFlight || authSession.authenticated;
  }
  if (emailLoginButton) {
    emailLoginButton.disabled = emailAuthInFlight || authSession.authenticated;
  }
  if (authAccount) {
    authAccount.hidden = !authSession.authenticated;
  }
  if (logoutButton) {
    logoutButton.disabled = authInFlight || emailAuthInFlight;
  }

  if (authSession.authenticated) {
    const maskedEmail = maskEmail(authSession.email);

    if (authTitle) {
      authTitle.textContent = "로그인됨";
    }
    if (authEmailLabel) {
      authEmailLabel.textContent = maskedEmail;
    }
    if (authStatus) {
      authStatus.textContent = authNotice || `${maskedEmail} 계정으로 로그인되어 있습니다.`;
      authStatus.classList.remove("is-error");
    }
    return;
  }

  if (authEmailLabel) {
    authEmailLabel.textContent = "";
  }
  if (authTitle) {
    authTitle.textContent = "이메일 로그인";
  }
  if (!authStatus) {
    renderGoogleSignInButton();
    return;
  }

  if (!authSession.databaseConfigured) {
    authStatus.textContent = authSession.message || "DB 연결이 아직 설정되지 않았습니다.";
    authStatus.classList.add("is-error");
    return;
  }

  authStatus.textContent = authNotice || "가입한 이메일과 비밀번호로 로그인합니다.";
  authStatus.classList.toggle("is-error", Boolean(authNotice && authNotice.includes("못했습니다")));
  renderGoogleSignInButton();
}

function renderGoogleSignInButton() {
  const configured = authSession.databaseConfigured && authSession.googleLoginConfigured;
  const clientId = authSession.googleClientId;

  if (!googleSignInButton || !configured || authSession.authenticated || !clientId) {
    return;
  }

  if (!window.google?.accounts?.id) {
    if (googleButtonRenderRetry < 20) {
      googleButtonRenderRetry += 1;
      window.setTimeout(renderGoogleSignInButton, 250);
    }
    return;
  }

  if (googleButtonRenderedForClientId === clientId) {
    return;
  }

  googleSignInButton.replaceChildren();
  googleButtonRenderRetry = 0;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredentialResponse,
  });
  window.google.accounts.id.renderButton(googleSignInButton, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.min(420, googleSignInButton.clientWidth || 360),
  });
  googleButtonRenderedForClientId = clientId;
}

function redirectToWorkspace() {
  window.setTimeout(() => {
    window.location.href = LOGIN_REDIRECT_HREF;
  }, 450);
}

function normalizeAuthSession(value) {
  return {
    authenticated: Boolean(value?.authenticated),
    email: normalizeEmail(value?.email),
    databaseConfigured: Boolean(value?.databaseConfigured),
    googleLoginConfigured: Boolean(value?.googleLoginConfigured),
    emailLoginConfigured: Boolean(value?.emailLoginConfigured),
    googleClientId: String(value?.googleClientId || "").trim(),
    message: typeof value?.message === "string" ? value.message : "",
  };
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(value) {
  const email = normalizeEmail(value);
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return email || "로그인 계정";
  }

  if (name.length <= 2) {
    return `${name[0] || "*"}*@${domain}`;
  }

  return `${name.slice(0, 2)}***@${domain}`;
}
