const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const authSource = read("api/_lib/auth.js");
const dbSource = read("api/_lib/db.js");
const authRouteSource = read("api/_lib/routes/auth.js");
const migration = read("migrations/006_enforce_single_user_session.sql");
const { createSession, getSessionUser } = require("../api/_lib/auth");

test("사용자별 세션은 DB에서 하나만 허용하고 로그인 시 원자적으로 교체한다", () => {
  assert.match(dbSource, /CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_user_id_unique_idx/);
  assert.match(dbSource, /ROW_NUMBER\(\) OVER \(/);
  assert.match(migration, /PARTITION BY user_id/);
  assert.match(migration, /WHERE session_rank > 1/);
  assert.match(authSource, /ON CONFLICT \(user_id\) DO UPDATE SET/);
  assert.match(authSource, /token_hash = EXCLUDED\.token_hash/);
});

test("이메일과 Google 로그인을 포함한 모든 세션 발급 경로가 단일 세션 생성을 사용한다", () => {
  assert.equal(
    (authRouteSource.match(/await createSession\(sql, request, response, user\.id\);/g) || []).length,
    3,
  );
});

test("같은 사용자가 다시 로그인하면 이전 쿠키는 무효가 되고 새 쿠키만 인증된다", async () => {
  const user = { id: 73, email: "single-session@example.com" };
  const sessions = new Map();
  const sql = createSessionSql(sessions, user);
  const firstResponse = createResponse();
  const secondResponse = createResponse();

  await createSession(sql, createRequest(), firstResponse, user.id);
  const firstToken = readSessionToken(firstResponse);

  await createSession(sql, createRequest(), secondResponse, user.id);
  const secondToken = readSessionToken(secondResponse);

  assert.notEqual(firstToken, secondToken);
  assert.equal(sessions.size, 1);
  assert.equal(await getSessionUser(sql, createRequest(firstToken)), null);
  assert.deepEqual(await getSessionUser(sql, createRequest(secondToken)), user);
});

function createSessionSql(sessions, user) {
  return {
    async query(query, params = []) {
      const statement = compactSql(query);

      if (statement === "delete from user_sessions where expires_at <= now()") {
        return [];
      }

      if (statement.startsWith("insert into user_sessions")) {
        assert.match(statement, /on conflict \(user_id\) do update set/);
        sessions.set(String(params[0]), params[1]);
        return [];
      }

      if (statement.includes("select s.user_id, u.email from user_sessions s")) {
        return sessions.get(String(user.id)) === params[0]
          ? [{ user_id: user.id, email: user.email }]
          : [];
      }

      if (statement === "update user_sessions set last_seen_at = now() where token_hash = $1") {
        return [];
      }

      throw new Error(`Unexpected session query: ${statement}`);
    },
  };
}

function createRequest(token = "") {
  return {
    headers: {
      host: "localhost",
      ...(token ? { cookie: `cue_sheet_session=${encodeURIComponent(token)}` } : {}),
    },
  };
}

function createResponse() {
  return {
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
    },
  };
}

function readSessionToken(response) {
  const cookie = String(response.headers.get("set-cookie") || "");
  const match = cookie.match(/^cue_sheet_session=([^;]+)/);

  assert.ok(match, "a session cookie must be issued");
  return decodeURIComponent(match[1]);
}

function compactSql(query) {
  return String(query).replace(/\s+/g, " ").trim().toLowerCase();
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}
