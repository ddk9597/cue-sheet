const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { after, test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "recruit.html"), "utf8");
const client = fs.readFileSync(path.join(ROOT, "recruit.js"), "utf8");
const styles = fs.readFileSync(path.join(ROOT, "recruit.css"), "utf8");
const schema = fs.readFileSync(path.join(ROOT, "api/_lib/db.js"), "utf8");
const recruitRoute = fs.readFileSync(path.join(ROOT, "api/_lib/routes/recruit.js"), "utf8");
const recruitMigration = fs.readFileSync(path.join(ROOT, "migrations/003_add_recruit_post_instruments.sql"), "utf8");
const recruitRegionMigration = fs.readFileSync(path.join(ROOT, "migrations/004_add_recruit_region_category.sql"), "utf8");
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
    assert.match(html, new RegExp(`name="instruments" value="${instrument}"`));
  }
});

test("게시글 작성과 검색은 여러 악기 파트를 동시에 선택한다", () => {
  assert.match(html, /type="checkbox" name="instruments"/);
  assert.match(html, /복수 선택 가능/);
  assert.match(client, /instruments: new Set\(\)/);
  assert.match(client, /formData\.getAll\("instruments"\)/);
  assert.match(client, /post\.instruments\.some\(\(instrument\) => state\.instruments\.has\(instrument\)\)/);
  assert.match(client, /appendInstrumentBadges\(badges, post\.instruments/);
  assert.match(styles, /\.post-instrument-options input:checked \+ span/);
});

test("모집 유형과 지역은 주요 카테고리로 조합하고 상세 검색은 접어 둔다", () => {
  for (const region of [
    "서울",
    "경기",
    "인천",
    "강원",
    "대전·세종·충청",
    "광주·전라",
    "대구·경북",
    "부산·울산·경남",
    "제주",
    "전국·온라인",
  ]) {
    assert.match(html, new RegExp(`data-region-filter="${region}"`));
    assert.match(html, new RegExp(`name="regionCategory" value="${region}"`));
  }

  assert.doesNotMatch(html, /name="region" type="text"/);
  assert.match(html, /<details id="recruitAdvancedSearch"/);
  assert.match(client, /region: "전체"/);
  assert.match(client, /post\.regionCategory === state\.region/);
  assert.match(client, /function resetFilters\(\)/);
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
  assert.match(schema, /instruments TEXT\[\] NOT NULL/);
  assert.match(schema, /SET instruments = ARRAY\[instrument\]/);
  assert.match(recruitMigration, /ADD COLUMN IF NOT EXISTS instruments TEXT\[\]/);
  assert.match(recruitRegionMigration, /ADD COLUMN IF NOT EXISTS region_category TEXT/);
  assert.match(recruitRoute, /\(user_id, intent, instrument, instruments,/);
  assert.match(recruitRoute, /normalizeInstrumentSelection\(payload\.instruments, payload\.instrument\)/);
  assert.match(recruitRoute, /normalizeRequestedRegionCategory\(payload\.regionCategory, payload\.region\)/);
  assert.match(schema, /region_category TEXT NOT NULL DEFAULT '전국·온라인'/);
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

const authModulePath = require.resolve("../api/_lib/auth");
const dbModulePath = require.resolve("../api/_lib/db");
const routeModulePath = require.resolve("../api/_lib/routes/recruit");
const originalAuthModule = require.cache[authModulePath];
const originalDbModule = require.cache[dbModulePath];
const originalRouteModule = require.cache[routeModulePath];
let activeRecruitSql = null;

const fakeAuthModule = new Module(authModulePath);
fakeAuthModule.filename = authModulePath;
fakeAuthModule.loaded = true;
fakeAuthModule.exports = {
  getSessionUser: async () => ({ id: 77, email: "writer@example.com" }),
};
require.cache[authModulePath] = fakeAuthModule;

const fakeDbModule = new Module(dbModulePath);
fakeDbModule.filename = dbModulePath;
fakeDbModule.loaded = true;
fakeDbModule.exports = {
  ensureSchema: async () => {},
  getSql: () => activeRecruitSql,
};
require.cache[dbModulePath] = fakeDbModule;
delete require.cache[routeModulePath];

const handleRecruit = require(routeModulePath);

after(() => {
  restoreModule(authModulePath, originalAuthModule);
  restoreModule(dbModulePath, originalDbModule);
  restoreModule(routeModulePath, originalRouteModule);
});

test("API는 여러 악기 파트를 하나의 게시글에 저장하고 반환한다", async () => {
  let insertParams = [];

  activeRecruitSql = {
    async query(statement, params = []) {
      const query = compactSql(statement);

      if (query.startsWith("insert into recruit_posts")) {
        insertParams = [...params];
        assert.match(query, /instrument, instruments/);
        assert.match(query, /\$4::text\[\]/);
        return [{ id: 501 }];
      }

      if (query.startsWith("select recruit_posts.id")) {
        return [{
          id: 501,
          intent: "구해요",
          instrument: "기타",
          instruments: ["기타", "보컬"],
          title: "기타와 보컬을 구합니다",
          region: "서울",
          genre: "록",
          schedule: "주 1회",
          content: "함께 활동할 멤버를 찾습니다.",
          contact: "message",
          comment_count: 0,
          author_user_id: 77,
          author_email: "writer@example.com",
          author_name: "작성자",
          author_picture_url: "",
          author_picture_key: "",
          created_at: "2026-07-21T00:00:00.000Z",
        }];
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };

  const response = await requestRecruit({
    intent: "구해요",
    instruments: ["기타", "보컬"],
    regionCategory: "서울",
    title: "기타와 보컬을 구합니다",
    genre: "록",
    schedule: "주 1회",
    content: "함께 활동할 멤버를 찾습니다.",
    contact: "message",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(insertParams.slice(0, 4), [77, "구해요", "기타", ["기타", "보컬"]]);
  assert.deepEqual(response.body.post.instruments, ["기타", "보컬"]);
  assert.equal(response.body.post.instrument, "기타");
  assert.equal(response.body.post.regionCategory, "서울");
});

test("API는 잘못된 파트가 하나라도 포함된 복수 선택을 거부한다", async () => {
  let queryCalled = false;

  activeRecruitSql = {
    async query() {
      queryCalled = true;
      return [];
    },
  };

  const response = await requestRecruit({
    intent: "할래요",
    instruments: ["기타", "피아노"],
    title: "밴드를 찾습니다",
    content: "가입할 밴드를 찾습니다.",
    contact: "message",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "invalid_recruit_instruments");
  assert.equal(queryCalled, false);
});

test("API는 직접 입력한 지역 대신 정해진 지역 카테고리만 받는다", async () => {
  let queryCalled = false;

  activeRecruitSql = {
    async query() {
      queryCalled = true;
      return [];
    },
  };

  const response = await requestRecruit({
    intent: "구해요",
    instruments: ["드럼"],
    regionCategory: "서울 마포",
    title: "드러머를 구합니다",
    content: "같이 활동할 멤버를 찾습니다.",
    contact: "message",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "invalid_recruit_region");
  assert.equal(queryCalled, false);
});

async function requestRecruit(body) {
  const response = createResponse();

  await handleRecruit({
    body,
    headers: { host: "localhost" },
    method: "POST",
    query: { path: ["recruit"] },
    url: "/api/recruit",
  }, response);
  return response;
}

function createResponse() {
  return {
    body: undefined,
    statusCode: undefined,
    headers: new Map(),
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function compactSql(statement) {
  return String(statement).replace(/\s+/g, " ").trim().toLowerCase();
}

function restoreModule(modulePath, originalModule) {
  if (originalModule) {
    require.cache[modulePath] = originalModule;
  } else {
    delete require.cache[modulePath];
  }
}
