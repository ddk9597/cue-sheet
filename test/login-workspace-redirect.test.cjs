const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const loginHtml = fs.readFileSync(path.join(ROOT, "login.html"), "utf8");
const loginScript = fs.readFileSync(path.join(ROOT, "login.js"), "utf8");
const workspaceHtml = fs.readFileSync(path.join(ROOT, "workspace.html"), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

test("이메일과 Google 로그인 완료 후 내 작업 공간으로 이동한다", () => {
  assert.match(loginScript, /const LOGIN_REDIRECT_HREF = "\.\/workspace\.html";/);
  assert.equal((loginScript.match(/redirectToWorkspace\(\);/g) || []).length, 2);
  assert.equal((loginScript.match(/내 작업 공간으로 이동합니다\./g) || []).length, 2);
  assert.doesNotMatch(loginScript, /mypage\.html|마이페이지로 이동/);
});

test("로그인된 계정의 바로가기 역시 내 작업 공간을 가리킨다", () => {
  assert.match(loginHtml, /href="\.\/workspace\.html">내 작업 공간<\/a>/);
  assert.doesNotMatch(loginHtml, /href="\.\/mypage\.html"/);
});

test("마이페이지 파일은 보존하되 현재 작업 동선과 영구 리다이렉트에서는 제외한다", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "mypage.html")), true);
  assert.doesNotMatch(workspaceHtml, /href="\.\/mypage\.html"/);
  assert.equal(
    vercelConfig.redirects.some(({ source }) => source === "/mypage" || source === "/mypage.html"),
    false,
  );
});
