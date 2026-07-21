(() => {
  const mount = document.querySelector("[data-site-header]");

  if (!mount) {
    return;
  }

  const currentPage = mount.dataset.current || "";
  const navigationItems = [
    {
      id: "home",
      label: "홈",
      href: "./index.html#overview",
    },
    {
      id: "about",
      label: "소개",
      href: "./about.html",
    },
    {
      id: "recruit",
      label: "밴드 구해요",
      href: "./recruit.html",
    },
    {
      id: "workspace",
      label: "내 작업 공간",
      href: "./workspace.html",
    },
  ];

  const navLinks = navigationItems.map((item) => {
    const ariaCurrent = item.id === currentPage ? ' aria-current="page"' : "";

    return `<a href="${item.href}"${ariaCurrent}>${item.label}</a>`;
  });
  const authAriaCurrent = currentPage === "login" ? ' aria-current="page"' : "";

  mount.outerHTML = `
    <header class="site-header">
      <div class="site-header-inner">
        <a class="site-brand" href="./index.html#overview">Cue Sheet</a>
        <nav class="site-nav" aria-label="상단 메뉴">
          ${navLinks.join("\n          ")}
          <a class="site-message-link" href="./workspace.html?tool=messages" hidden data-direct-message-link>
            <span>메시지함</span>
            <strong class="site-message-count" hidden data-direct-message-count>0</strong>
          </a>
          <a href="./login.html"${authAriaCurrent} hidden data-auth-nav-link data-signup-href="./login.html">로그인</a>
        </nav>
      </div>
    </header>
    <div class="site-message-toast" hidden data-direct-message-toast role="status" aria-live="polite" aria-atomic="true">
      <span data-direct-message-toast-copy>새 쪽지가 도착했습니다.</span>
      <a href="./workspace.html?tool=messages" data-direct-message-link>확인</a>
      <button type="button" data-direct-message-toast-close aria-label="쪽지 알림 닫기">×</button>
    </div>
  `;
})();
