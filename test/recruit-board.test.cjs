const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "recruit.html"), "utf8");
const client = fs.readFileSync(path.join(ROOT, "recruit.js"), "utf8");
const schema = fs.readFileSync(path.join(ROOT, "api/_lib/db.js"), "utf8");
const recruitRoute = fs.readFileSync(path.join(ROOT, "api/_lib/routes/recruit.js"), "utf8");
const memberRoute = fs.readFileSync(path.join(ROOT, "api/_lib/routes/member.js"), "utf8");
const router = fs.readFileSync(path.join(ROOT, "api/_lib/routes/router.js"), "utf8");
const workspaceClient = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");

test("구인 게시판은 요청된 모집 유형과 악기 분류를 모두 제공한다", () => {
  for (const intent of ["구해요", "할래요"]) {
    assert.match(html, new RegExp(`value="${intent}"`));
    assert.match(html, new RegExp(`data-intent-filter="${intent}"`));
  }

  for (const instrument of ["일렉", "드럼", "기타", "베이스", "보컬", "신디"]) {
    assert.match(html, new RegExp(`data-instrument-filter="${instrument}"`));
    assert.match(html, new RegExp(`<option value="${instrument}">${instrument}</option>`));
  }
});

test("게시판 클라이언트는 검색, 필터, 작성 API를 연결한다", () => {
  assert.match(client, /const API_ENDPOINT = "\/api\/recruit"/);
  assert.match(client, /function matchesCurrentFilters\(post\)/);
  assert.match(client, /method: "POST"/);
  assert.doesNotMatch(client, /innerHTML\s*=/);
});

test("게시글 저장 스키마와 API 라우트가 등록되어 있다", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS recruit_posts/);
  assert.match(schema, /'구해요', '할래요'/);
  assert.match(schema, /'일렉', '드럼', '기타', '베이스', '보컬', '신디'/);
  assert.match(router, /\["recruit", recruitHandler\]/);
});

test("게시글 API와 화면은 작성자 아이디 및 프로필 사진을 제공한다", () => {
  assert.match(recruitRoute, /app_users\.email AS author_email/);
  assert.match(recruitRoute, /app_users\.picture_url AS author_picture_url/);
  assert.match(recruitRoute, /app_users\.picture_key AS author_picture_key/);
  assert.match(recruitRoute, /authorId: getPublicAuthorId/);
  assert.match(recruitRoute, /authorPictureUrl: resolveProfilePictureUrl/);
  assert.match(client, /createAuthorIdentity\(post/);
  assert.match(client, /createAuthorAvatar\(post\)/);
  assert.match(client, /post\.authorId/);
});

test("게시글 댓글은 회원 정보와 함께 저장되고 상세 화면에서 동작한다", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS recruit_comments/);
  assert.match(schema, /post_id BIGINT NOT NULL REFERENCES recruit_posts\(id\) ON DELETE CASCADE/);
  assert.match(schema, /user_id BIGINT NOT NULL REFERENCES app_users\(id\) ON DELETE CASCADE/);
  assert.match(recruitRoute, /segments\[1\] === "comments"/);
  assert.match(recruitRoute, /handleListComments/);
  assert.match(recruitRoute, /handleCreateComment/);
  assert.match(recruitRoute, /로그인 후 댓글을 작성할 수 있습니다/);
  assert.match(recruitRoute, /COUNT\(\*\)::int FROM recruit_comments/);
  assert.match(client, /function createCommentSection\(post\)/);
  assert.match(client, /async function loadComments\(postId\)/);
  assert.match(client, /async function submitComment\(event\)/);
  assert.match(client, /createAuthorIdentity\(comment/);
});

test("게시글 작성자 쪽지는 서버가 수신자를 결정하고 메시지함에 표시된다", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS direct_messages/);
  assert.match(schema, /sender_user_id BIGINT NOT NULL REFERENCES app_users\(id\) ON DELETE CASCADE/);
  assert.match(schema, /recipient_user_id BIGINT NOT NULL REFERENCES app_users\(id\) ON DELETE CASCADE/);
  assert.match(schema, /recruit_post_id BIGINT REFERENCES recruit_posts\(id\) ON DELETE SET NULL/);
  assert.match(recruitRoute, /segments\[1\] === "message"/);
  assert.match(recruitRoute, /handleCreateDirectMessage/);
  assert.match(recruitRoute, /String\(post\.user_id\) === String\(sessionUser\.id\)/);
  assert.match(recruitRoute, /sessionUser\.id, post\.user_id, postId, subject, body/);
  assert.match(client, /function createDirectMessageSection\(post\)/);
  assert.match(client, /async function submitDirectMessage\(event\)/);
  assert.match(client, /panel\.dataset\.authorUserId === state\.userId/);
  assert.match(memberRoute, /directMessageRows\.map\(normalizeDirectMessageRow\)/);
  assert.match(memberRoute, /WHERE recipient_user_id = \$1 AND is_read = FALSE/);
  assert.match(memberRoute, /UPDATE direct_messages/);
  assert.match(workspaceClient, /message\.type === "direct_message"/);
  assert.match(workspaceClient, /보낸 사람 \$\{sender\}/);
});
