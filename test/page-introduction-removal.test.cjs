const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(ROOT, fileName), "utf8");
}

test("각 페이지는 장식성 소개 영역 없이 실제 콘텐츠로 시작한다", () => {
  const pages = [
    ["index.html", "main-hero"],
    ["workspace.html", "workspace-hero"],
    ["mypage.html", "mypage-hero"],
    ["login.html", "login-hero"],
    ["about.html", "about-hero"],
    ["recruit.html", "recruit-hero"],
    ["community.html", "community-hero"],
    ["signup.html", "signup-intro"],
  ];

  for (const [fileName, className] of pages) {
    assert.doesNotMatch(read(fileName), new RegExp(`class="[^"]*${className}`));
  }
});

test("소개 영역을 제거해도 기존 기능 진입점과 상태 안내는 유지한다", () => {
  const index = read("index.html");
  const workspace = read("workspace.html");
  const signup = read("signup.html");

  assert.match(index, /id="overview" class="main-section intro-section"/);
  assert.match(workspace, /data-modal-target="workspaceModal"/);
  assert.match(workspace, /data-modal-target="groupModal"/);
  assert.match(workspace, /data-modal-target="messagesModal"/);
  assert.match(signup, /id="signupTitle" class="sr-only"/);
  assert.match(signup, /id="signupStatus" class="signup-status signup-inline-status"/);
});
