const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const styles = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const communityStyles = fs.readFileSync(path.join(ROOT, "community.css"), "utf8");
const recruitStyles = fs.readFileSync(path.join(ROOT, "recruit.css"), "utf8");
const audienceStyles = fs.readFileSync(path.join(ROOT, "audience.css"), "utf8");
const signup = fs.readFileSync(path.join(ROOT, "signup.html"), "utf8");

test("모바일 공통 페이지 소개 영역은 작은 제목과 여백을 사용한다", () => {
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.hero,[\s\S]*?padding: 16px 18px/);
  assert.match(styles, /\.home-title,[\s\S]*?\.login-hero \.home-title[\s\S]*?font-size: clamp\(1\.55rem, 7vw, 2rem\)/);
  assert.match(styles, /\.hero-copy,[\s\S]*?\.login-hero \.hero-copy[\s\S]*?font-size: 0\.86rem/);
  assert.match(styles, /\.about-hero-points,[\s\S]*?\.about-hero-visual[\s\S]*?display: none/);
});

test("커뮤니티와 구인 소개 문구는 모바일에서 강제 줄바꿈과 큰 여백을 제거한다", () => {
  assert.match(communityStyles, /\.community-hero \{\s*padding: 18px/);
  assert.match(communityStyles, /\.community-hero h1 br \{\s*display: none/);
  assert.match(recruitStyles, /\.recruit-hero \{\s*padding: 18px/);
  assert.match(recruitStyles, /\.recruit-hero h1 br \{\s*display: none/);
});

test("관객 화면과 회원가입 소개 영역도 모바일 밀도를 줄인다", () => {
  assert.match(audienceStyles, /\.live-summary \{\s*min-height: auto;\s*gap: 10px;\s*padding: 18px 2px 12px/);
  assert.match(signup, /@media \(max-width: 720px\)[\s\S]*?\.signup-intro \{[\s\S]*?gap: 10px;\s*padding: 14px/);
});
