(() => {
  const SESSION_ENDPOINT = "/api/auth/session";
  const UNREAD_DIRECT_MESSAGE_ENDPOINT = "/api/member/messages/unread-count";
  const SIGNUP_LABEL = "로그인";
  const DEFAULT_SIGNUP_HREF = "./login.html";
  const MESSAGE_POLL_INTERVAL_MS = 30000;
  const MESSAGE_TOAST_DURATION_MS = 6000;
  let authenticatedState = null;
  let unreadDirectMessageCount = null;
  let messagePollTimer = null;
  let messageToastTimer = null;
  let messageCountRequest = null;

  window.CueSheetAuthNav = {
    refresh: updateAuthNavigation,
    setAuthenticated: setAuthNavigationState,
    refreshMessages: refreshDirectMessageNotifications,
  };

  updateAuthNavigation();
  setupDirectMessageNotifications();

  async function updateAuthNavigation() {
    const authenticated = await getAuthenticatedSession();

    if (authenticated === null) {
      return;
    }

    setAuthNavigationState(authenticated);
  }

  function setAuthNavigationState(authenticated) {
    const isAuthenticated = authenticated === true;
    const authenticationChanged = authenticatedState !== isAuthenticated;
    const authLinks = [...document.querySelectorAll("[data-auth-nav-link]")];

    for (const link of authLinks) {
      link.hidden = isAuthenticated;
      link.textContent = SIGNUP_LABEL;
      link.href = link.dataset.signupHref || DEFAULT_SIGNUP_HREF;
      link.setAttribute("aria-label", SIGNUP_LABEL);
    }

    for (const link of getDirectMessageLinks()) {
      link.hidden = !isAuthenticated;
    }

    authenticatedState = isAuthenticated;

    if (isAuthenticated) {
      startDirectMessagePolling();

      if (authenticationChanged) {
        unreadDirectMessageCount = null;
        void refreshDirectMessageNotifications({ announce: false });
      }
      return;
    }

    stopDirectMessagePolling();
    unreadDirectMessageCount = null;
    updateDirectMessageBadge(0);
    hideDirectMessageToast();
  }

  function setupDirectMessageNotifications() {
    const closeButton = document.querySelector?.("[data-direct-message-toast-close]");

    closeButton?.addEventListener("click", hideDirectMessageToast);

    for (const link of getDirectMessageLinks()) {
      link.addEventListener?.("click", hideDirectMessageToast);
    }

    window.addEventListener?.("focus", () => {
      void refreshDirectMessageNotifications();
    });
    document.addEventListener?.("visibilitychange", () => {
      if (document.visibilityState !== "hidden") {
        void refreshDirectMessageNotifications();
      }
    });
  }

  function startDirectMessagePolling() {
    if (messagePollTimer !== null || typeof window.setInterval !== "function") {
      return;
    }

    messagePollTimer = window.setInterval(() => {
      void refreshDirectMessageNotifications();
    }, MESSAGE_POLL_INTERVAL_MS);
  }

  function stopDirectMessagePolling() {
    if (messagePollTimer !== null && typeof window.clearInterval === "function") {
      window.clearInterval(messagePollTimer);
    }

    messagePollTimer = null;
    messageCountRequest = null;
  }

  async function refreshDirectMessageNotifications(options = {}) {
    const { announce = true } = options;

    if (authenticatedState !== true) {
      return null;
    }

    if (messageCountRequest) {
      return messageCountRequest;
    }

    messageCountRequest = (async () => {
      try {
        const response = await fetch(UNREAD_DIRECT_MESSAGE_ENDPOINT, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => ({}));

        if (response.status === 401) {
          setAuthNavigationState(false);
          return null;
        }

        if (!response.ok || authenticatedState !== true) {
          return null;
        }

        const nextCount = Math.max(0, Math.floor(Number(payload.unreadDirectMessageCount) || 0));
        const previousCount = unreadDirectMessageCount;

        unreadDirectMessageCount = nextCount;
        updateDirectMessageBadge(nextCount);
        dispatchDirectMessageCount(nextCount, previousCount);

        if (announce && previousCount !== null && nextCount > previousCount) {
          showDirectMessageToast(nextCount - previousCount);
        }

        return nextCount;
      } catch {
        return null;
      } finally {
        messageCountRequest = null;
      }
    })();

    return messageCountRequest;
  }

  function getDirectMessageLinks() {
    return [...document.querySelectorAll("[data-direct-message-link]")]
      .filter((link) => Object.hasOwn(link.dataset || {}, "directMessageLink"));
  }

  function getDirectMessageBadges() {
    return [...document.querySelectorAll("[data-direct-message-count]")]
      .filter((badge) => Object.hasOwn(badge.dataset || {}, "directMessageCount"));
  }

  function updateDirectMessageBadge(count) {
    for (const badge of getDirectMessageBadges()) {
      badge.textContent = String(count);
      badge.hidden = count < 1;
    }

    for (const link of getDirectMessageLinks()) {
      link.setAttribute?.(
        "aria-label",
        count > 0 ? `메시지함, 안 읽은 쪽지 ${count}개` : "메시지함, 새 쪽지 없음",
      );
    }
  }

  function showDirectMessageToast(increase) {
    const toast = document.querySelector?.("[data-direct-message-toast]");
    const copy = toast?.querySelector?.("[data-direct-message-toast-copy]");

    if (!toast || !copy) {
      return;
    }

    copy.textContent = increase > 1
      ? `새 쪽지 ${increase}개가 도착했습니다.`
      : "새 쪽지가 도착했습니다.";
    toast.hidden = false;

    if (messageToastTimer !== null && typeof window.clearTimeout === "function") {
      window.clearTimeout(messageToastTimer);
    }

    messageToastTimer = typeof window.setTimeout === "function"
      ? window.setTimeout(hideDirectMessageToast, MESSAGE_TOAST_DURATION_MS)
      : null;
  }

  function hideDirectMessageToast() {
    const toast = document.querySelector?.("[data-direct-message-toast]");

    if (toast) {
      toast.hidden = true;
    }

    if (messageToastTimer !== null && typeof window.clearTimeout === "function") {
      window.clearTimeout(messageToastTimer);
    }

    messageToastTimer = null;
  }

  function dispatchDirectMessageCount(count, previousCount) {
    if (typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") {
      return;
    }

    window.dispatchEvent(new window.CustomEvent("cue-sheet:direct-message-count", {
      detail: { count, previousCount },
    }));
  }

  async function getAuthenticatedSession() {
    try {
      const response = await fetch(SESSION_ENDPOINT, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();

      if (payload?.authenticated === true) {
        return true;
      }

      if (payload?.authenticated === false) {
        return false;
      }

      return null;
    } catch {
      return null;
    }
  }
})();
