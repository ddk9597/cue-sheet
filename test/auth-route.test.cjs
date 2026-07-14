const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");
const { after, beforeEach, test } = require("node:test");

const SESSION_TOKEN = "route-session-token";
const USER = Object.freeze({ id: 303, email: "member@example.com" });

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function compactSql(query) {
  return String(query).replace(/\s+/g, " ").trim().toLowerCase();
}

let databaseConfigured = true;
let failSessionDelete = false;
let sessionExists = true;

const sql = {
  async query(query, params = []) {
    const statement = compactSql(query);

    if (statement === "delete from user_sessions where expires_at <= now()") {
      return [];
    }

    if (
      statement.includes("select s.user_id, u.email from user_sessions s")
      && statement.includes("join app_users u on u.id = s.user_id")
    ) {
      return sessionExists && params[0] === hashSessionToken(SESSION_TOKEN)
        ? [{ user_id: USER.id, email: USER.email }]
        : [];
    }

    if (statement === "update user_sessions set last_seen_at = now() where token_hash = $1") {
      return [];
    }

    if (statement === "delete from user_sessions where token_hash = $1") {
      if (failSessionDelete) {
        throw new Error("session delete failed");
      }

      sessionExists = false;
      return [];
    }

    throw new Error(`Fake auth database received an unsupported query: ${statement}`);
  },
};

const dbModulePath = require.resolve("../api/_lib/db");
const routeModulePath = require.resolve("../api/_lib/routes/auth");
const originalDbModule = require.cache[dbModulePath];
const originalRouteModule = require.cache[routeModulePath];
const fakeDbModule = new Module(dbModulePath);

fakeDbModule.filename = dbModulePath;
fakeDbModule.loaded = true;
fakeDbModule.exports = {
  ensureSchema: async () => {},
  getSql: () => (databaseConfigured ? sql : null),
};
require.cache[dbModulePath] = fakeDbModule;
delete require.cache[routeModulePath];

const handleAuth = require(routeModulePath);

after(() => {
  delete require.cache[routeModulePath];

  if (originalRouteModule) {
    require.cache[routeModulePath] = originalRouteModule;
  }

  if (originalDbModule) {
    require.cache[dbModulePath] = originalDbModule;
  } else {
    delete require.cache[dbModulePath];
  }
});

beforeEach(() => {
  databaseConfigured = true;
  failSessionDelete = false;
  sessionExists = true;
});

function createRequest(route, method, token = "") {
  const headers = { host: "localhost" };

  if (token) {
    headers.cookie = `cue_sheet_session=${encodeURIComponent(token)}`;
  }

  return {
    headers,
    method,
    query: { path: ["auth", route] },
    url: `/api/auth/${route}`,
  };
}

function createResponse() {
  return {
    body: undefined,
    headers: new Map(),
    statusCode: undefined,
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

async function requestAuth(route, method, token) {
  const response = createResponse();

  await handleAuth(createRequest(route, method, token), response);
  return response;
}

function assertExpiredCookie(response) {
  const cookie = String(response.headers.get("set-cookie") || "");

  assert.match(cookie, /^cue_sheet_session=/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /HttpOnly/);
}

test("세션 응답은 인증 회원의 문자열 userId와 비인증 null을 구분한다", async () => {
  const authenticated = await requestAuth("session", "GET", SESSION_TOKEN);

  assert.equal(authenticated.statusCode, 200);
  assert.equal(authenticated.body.authenticated, true);
  assert.equal(typeof authenticated.body.userId, "string");
  assert.equal(authenticated.body.userId, String(USER.id));
  assert.equal(authenticated.body.email, USER.email);

  const anonymous = await requestAuth("session", "GET");

  assert.equal(anonymous.statusCode, 200);
  assert.equal(anonymous.body.authenticated, false);
  assert.equal(anonymous.body.userId, null);
});

test("DB 미설정 로그아웃도 쿠키를 만료하고 userId null을 반환한다", async () => {
  databaseConfigured = false;

  const response = await requestAuth("logout", "POST", "%malformed-session");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.userId, null);
  assertExpiredCookie(response);
});

test("세션 행 삭제 실패 응답에서도 쿠키 만료와 userId null이 유지된다", async () => {
  failSessionDelete = true;
  const originalConsoleError = console.error;

  console.error = () => {};

  try {
    const response = await requestAuth("logout", "POST", SESSION_TOKEN);

    assert.equal(response.statusCode, 500);
    assert.equal(response.body.error, "logout_failed");
    assert.equal(response.body.userId, null);
    assertExpiredCookie(response);
  } finally {
    console.error = originalConsoleError;
  }
});
