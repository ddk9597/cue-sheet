const assert = require("node:assert/strict");
const { test } = require("node:test");

const { destroySession } = require("../api/_lib/auth");

function createResponse() {
  return {
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
    },
  };
}

function assertExpiredSessionCookie(response) {
  const cookie = String(response.headers.get("set-cookie") || "");

  assert.match(cookie, /^cue_sheet_session=/);
  assert.match(cookie, /Max-Age=0/);
  assert.match(cookie, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
}

test("손상된 세션 쿠키도 로그아웃 시 만료된다", async () => {
  let queryCalled = false;
  const response = createResponse();

  await destroySession(
    {
      async query() {
        queryCalled = true;
      },
    },
    {
      headers: {
        cookie: "cue_sheet_session=%E0%A4%A",
        host: "localhost",
      },
    },
    response,
  );

  assert.equal(queryCalled, false);
  assertExpiredSessionCookie(response);
});

test("세션 행 삭제가 실패해도 브라우저 쿠키는 만료된다", async () => {
  const response = createResponse();

  await assert.rejects(
    destroySession(
      {
        async query() {
          throw new Error("database unavailable");
        },
      },
      {
        headers: {
          cookie: "cue_sheet_session=valid-session-token",
          host: "localhost",
        },
      },
      response,
    ),
    /database unavailable/,
  );

  assertExpiredSessionCookie(response);
});
