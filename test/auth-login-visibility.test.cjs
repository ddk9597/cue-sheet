const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const authNavSource = fs.readFileSync(path.join(ROOT, "auth-nav.js"), "utf8");
const mypageHtml = fs.readFileSync(path.join(ROOT, "mypage.html"), "utf8");
const scriptSource = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const siteHeaderSource = fs.readFileSync(path.join(ROOT, "site-header.js"), "utf8");
const styleSource = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const workspaceHtml = fs.readFileSync(path.join(ROOT, "workspace.html"), "utf8");

test("로그인 링크는 세션 확인 전 기본적으로 숨겨진다", () => {
  assert.match(workspaceHtml, /class="ghost-button member-login-link"[^>]*\bhidden\b/);
  assert.match(mypageHtml, /class="ghost-button member-login-link"[^>]*\bhidden\b/);
  assert.match(siteHeaderSource, /\bhidden\s+data-auth-nav-link\b/);
  assert.match(
    styleSource,
    /\[data-auth-nav-link\]\[hidden\],[\s\S]*?\.member-login-link\[hidden\]\s*\{\s*display:\s*none;/,
  );
});

test("회원 패널 로그인 링크는 확인된 비로그인 상태에서만 표시된다", () => {
  assert.match(
    scriptSource,
    /memberLoginLink\.hidden = !authSession\.resolved \|\| authSession\.authenticated;/,
  );
});

test("상단 로그인 링크는 인증 상태에 따라 숨김이 전환된다", () => {
  const authLink = {
    dataset: {},
    hidden: true,
    href: "./login.html",
    setAttribute() {},
    textContent: "로그인",
  };
  const sandbox = {
    document: {
      querySelectorAll() {
        return [authLink];
      },
    },
    fetch() {
      return new Promise(() => {});
    },
  };

  sandbox.window = sandbox;
  vm.runInNewContext(authNavSource, sandbox);

  sandbox.CueSheetAuthNav.setAuthenticated(true);
  assert.equal(authLink.hidden, true);

  sandbox.CueSheetAuthNav.setAuthenticated(false);
  assert.equal(authLink.hidden, false);
});

test("상단 로그인 링크는 확인된 비로그인 응답에서만 표시된다", async () => {
  const authLink = {
    dataset: {},
    hidden: true,
    setAttribute() {},
  };
  let response = {
    ok: false,
    async json() {
      return {};
    },
  };
  const sandbox = {
    document: {
      querySelectorAll() {
        return [authLink];
      },
    },
    async fetch() {
      return response;
    },
  };

  sandbox.window = sandbox;
  vm.runInNewContext(authNavSource, sandbox);

  await sandbox.CueSheetAuthNav.refresh();
  assert.equal(authLink.hidden, true, "세션 확인 실패 시 로그인 링크를 표시하지 않는다");

  response = {
    ok: true,
    async json() {
      return { authenticated: false };
    },
  };

  await sandbox.CueSheetAuthNav.refresh();
  assert.equal(authLink.hidden, false, "비로그인 상태가 확인되면 로그인 링크를 표시한다");
});
