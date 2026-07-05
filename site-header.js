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
      id: "cues",
      label: "목록 편집",
      href: "./cues.html#cue-editor",
    },
    {
      id: "audience",
      label: "관객용 목록",
      href: "./audience.html",
    },
  ];

  const navLinks = navigationItems.map((item) => {
    const ariaCurrent = item.id === currentPage ? ' aria-current="page"' : "";

    return `<a href="${item.href}"${ariaCurrent}>${item.label}</a>`;
  });

  mount.outerHTML = `
    <header class="site-header">
      <div class="site-header-inner">
        <a class="site-brand" href="./index.html#overview">Cue Sheet</a>
        <nav class="site-nav" aria-label="상단 메뉴">
          ${navLinks.join("\n          ")}
          <a href="./signup.html" data-auth-nav-link data-signup-href="./signup.html" data-mypage-href="./index.html#memberPanel">회원가입</a>
        </nav>
      </div>
    </header>
  `;
})();
