const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { after, test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const html = read("community.html");
const client = read("community.js");
const styles = read("community.css");
const schema = read("api/_lib/db.js");
const routeSource = read("api/_lib/routes/community.js");
const router = read("api/_lib/routes/router.js");
const siteHeader = read("site-header.js");
const indexHtml = read("index.html");
const migration = read("migrations/005_add_community_board.sql");

test("커뮤니티는 구인 게시판과 분리된 독립 페이지로 제공된다", () => {
  assert.match(html, /data-current="community"/);
  assert.match(html, /id="communityPostList"/);
  assert.match(siteHeader, /href: "\.\/community\.html"/);
  assert.match(indexHtml, /href="\.\/community\.html"/);
  assert.match(router, /\["community", communityHandler\]/);
});

test("커뮤니티는 친목과 교류에 맞는 명확한 분류를 제공한다", () => {
  for (const category of ["자유", "합주·친목", "공연·모임", "정보공유"]) {
    assert.match(html, new RegExp(`data-community-category="${category}"`));
    assert.match(html, new RegExp(`name="category" value="${category}"`));
  }

  assert.match(client, /const CATEGORIES = new Set/);
  assert.match(client, /function matchesCurrentFilters\(post\)/);
  assert.match(styles, /\.community-category-filter button\.is-active/);
});

test("커뮤니티 글과 댓글은 회원 정보와 함께 저장되고 표시된다", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS community_posts/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS community_comments/);
  assert.match(migration, /REFERENCES community_posts\(id\) ON DELETE CASCADE/);
  assert.match(routeSource, /app_users\.email AS author_email/);
  assert.match(routeSource, /authorPictureUrl: resolveProfilePictureUrl/);
  assert.match(routeSource, /segments\[1\] === "comments"/);
  assert.match(client, /async function submitComment\(event\)/);
  assert.match(client, /createAuthorIdentity\(comment\)/);
  assert.doesNotMatch(client, /innerHTML\s*=/);
});

const authModulePath = require.resolve("../api/_lib/auth");
const dbModulePath = require.resolve("../api/_lib/db");
const routeModulePath = require.resolve("../api/_lib/routes/community");
const originalAuthModule = require.cache[authModulePath];
const originalDbModule = require.cache[dbModulePath];
const originalRouteModule = require.cache[routeModulePath];
let activeSql = null;

const fakeAuthModule = new Module(authModulePath);
fakeAuthModule.filename = authModulePath;
fakeAuthModule.loaded = true;
fakeAuthModule.exports = {
  getSessionUser: async () => ({ id: 91, email: "community@example.com" }),
};
require.cache[authModulePath] = fakeAuthModule;

const fakeDbModule = new Module(dbModulePath);
fakeDbModule.filename = dbModulePath;
fakeDbModule.loaded = true;
fakeDbModule.exports = {
  ensureSchema: async () => {},
  getSql: () => activeSql,
};
require.cache[dbModulePath] = fakeDbModule;
delete require.cache[routeModulePath];

const handleCommunity = require(routeModulePath);

after(() => {
  restoreModule(authModulePath, originalAuthModule);
  restoreModule(dbModulePath, originalDbModule);
  restoreModule(routeModulePath, originalRouteModule);
});

test("회원은 커뮤니티 글을 작성하고 작성자 정보와 함께 받는다", async () => {
  let insertParams = [];

  activeSql = {
    async query(statement, params = []) {
      const query = compactSql(statement);

      if (query.startsWith("insert into community_posts")) {
        insertParams = [...params];
        return [{ id: 701 }];
      }

      if (query.startsWith("select community_posts.id")) {
        return [communityPostRow()];
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };

  const response = await requestCommunity("", "POST", {
    category: "합주·친목",
    title: "주말 번개 합주 하실 분",
    content: "편하게 모여 합주해요.",
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(insertParams, [91, "합주·친목", "주말 번개 합주 하실 분", "편하게 모여 합주해요."]);
  assert.equal(response.body.post.authorId, "@community");
  assert.equal(response.body.post.category, "합주·친목");
});

test("커뮤니티 댓글은 해당 글 존재를 확인한 뒤 등록된다", async () => {
  const queries = [];

  activeSql = {
    async query(statement, params = []) {
      const query = compactSql(statement);
      queries.push({ query, params: [...params] });

      if (query.startsWith("select id from community_posts")) {
        return [{ id: 701 }];
      }

      if (query.startsWith("insert into community_comments")) {
        return [{ id: 801 }];
      }

      if (query.startsWith("select community_comments.id")) {
        return [{
          id: 801,
          post_id: 701,
          content: "좋아요. 참여하고 싶어요!",
          author_user_id: 91,
          author_email: "community@example.com",
          author_name: "커뮤니티 회원",
          author_picture_url: "",
          author_picture_key: "",
          created_at: "2026-07-21T01:00:00.000Z",
        }];
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };

  const response = await requestCommunity("701/comments", "POST", {
    content: "좋아요. 참여하고 싶어요!",
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.comment.postId, "701");
  assert.match(queries[0].query, /^select id from community_posts/);
  assert.deepEqual(queries[1].params, ["701", 91, "좋아요. 참여하고 싶어요!"]);
});

test("허용되지 않은 커뮤니티 분류는 DB 저장 전에 거부한다", async () => {
  let queryCalled = false;

  activeSql = {
    async query() {
      queryCalled = true;
      return [];
    },
  };

  const response = await requestCommunity("", "POST", {
    category: "구인",
    title: "잘못된 분류",
    content: "커뮤니티와 구인 게시판은 분리됩니다.",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "invalid_community_category");
  assert.equal(queryCalled, false);
});

function communityPostRow() {
  return {
    id: 701,
    category: "합주·친목",
    title: "주말 번개 합주 하실 분",
    content: "편하게 모여 합주해요.",
    comment_count: 0,
    author_user_id: 91,
    author_email: "community@example.com",
    author_name: "커뮤니티 회원",
    author_picture_url: "",
    author_picture_key: "",
    created_at: "2026-07-21T00:00:00.000Z",
  };
}

async function requestCommunity(route, method, body) {
  const response = createResponse();
  const segments = ["community", ...route.split("/").filter(Boolean)];

  await handleCommunity({
    body,
    headers: { host: "localhost" },
    method,
    query: { path: segments },
    url: `/api/community${route ? `/${route}` : ""}`,
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

function read(fileName) {
  return fs.readFileSync(path.join(ROOT, fileName), "utf8");
}
