(() => {
  const SESSION_ENDPOINT = "/api/auth/session";
  const SIGNUP_LABEL = "회원가입";
  const MYPAGE_LABEL = "마이페이지";
  const DEFAULT_SIGNUP_HREF = "./signup.html";
  const DEFAULT_MYPAGE_HREF = "./workspace.html#memberPanel";

  window.CueSheetAuthNav = {
    refresh: updateAuthNavigation,
    setAuthenticated: setAuthNavigationState,
  };

  updateAuthNavigation();

  async function updateAuthNavigation() {
    const authenticated = await isAuthenticatedSession();

    setAuthNavigationState(authenticated);
  }

  function setAuthNavigationState(authenticated) {
    const authLinks = [...document.querySelectorAll("[data-auth-nav-link]")];

    for (const link of authLinks) {
      const nextLabel = authenticated ? MYPAGE_LABEL : SIGNUP_LABEL;
      const nextHref = authenticated
        ? link.dataset.mypageHref || DEFAULT_MYPAGE_HREF
        : link.dataset.signupHref || DEFAULT_SIGNUP_HREF;

      link.textContent = nextLabel;
      link.href = nextHref;
      link.setAttribute("aria-label", nextLabel);
    }
  }

  async function isAuthenticatedSession() {
    try {
      const response = await fetch(SESSION_ENDPOINT, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json();

      return Boolean(payload?.authenticated);
    } catch {
      return false;
    }
  }
})();
