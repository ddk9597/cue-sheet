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
          <a href="./login.html"${authAriaCurrent} hidden data-auth-nav-link data-signup-href="./login.html">로그인</a>
        </nav>
      </div>
    </header>
  `;
})();
