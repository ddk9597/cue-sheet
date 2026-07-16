(() => {
  const SESSION_ENDPOINT = "/api/auth/session";
  const SIGNUP_LABEL = "로그인";
  const DEFAULT_SIGNUP_HREF = "./login.html";

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
      link.hidden = authenticated;
      link.textContent = SIGNUP_LABEL;
      link.href = link.dataset.signupHref || DEFAULT_SIGNUP_HREF;
      link.setAttribute("aria-label", SIGNUP_LABEL);
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
