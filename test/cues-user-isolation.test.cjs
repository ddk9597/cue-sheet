const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");
const { after, test } = require("node:test");

const USER_A = Object.freeze({ id: 101, email: "a@example.com" });
const USER_B = Object.freeze({ id: 202, email: "b@example.com" });
const SESSION_A = "session-a";
const SESSION_B = "session-b";
const EXPIRED_SESSION = "session-expired";
const LEGACY_STORAGE_ROW_ID = 1;

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function cue(title, id = title, seconds = 180) {
  return {
    id,
    type: "song",
    title,
    bpm: "120",
    seconds,
    acousticTuning: "standard",
    electricTuning: "standard",
    bassTuning: "standard",
  };
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compactSql(query) {
  return String(query).replace(/\s+/g, " ").trim().toLowerCase();
}

function createFakeDatabase() {
  const state = {
    users: new Map(),
    sessions: new Map(),
    userCueSheets: new Map(),
    legacyCueSheet: null,
    writeCount: 0,
  };

  function reset() {
    state.users = new Map([
      [USER_A.id, USER_A],
      [USER_B.id, USER_B],
    ]);
    state.sessions = new Map([
      [hashSessionToken(SESSION_A), {
        userId: USER_A.id,
        expiresAt: Date.now() + 60_000,
      }],
      [hashSessionToken(SESSION_B), {
        userId: USER_B.id,
        expiresAt: Date.now() + 60_000,
      }],
      [hashSessionToken(EXPIRED_SESSION), {
        userId: USER_A.id,
        expiresAt: Date.now() - 60_000,
      }],
    ]);
    state.userCueSheets = new Map();
    state.legacyCueSheet = {
      items: [cue("공용 익명 큐", "legacy-cue", 45)],
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    };
    state.writeCount = 0;
  }

  const sql = {
    async query(query, params = []) {
      const statement = compactSql(query);

      if (statement === "delete from user_sessions where expires_at <= now()") {
        const now = Date.now();

        for (const [tokenHash, session] of state.sessions) {
          if (session.expiresAt <= now) {
            state.sessions.delete(tokenHash);
          }
        }

        return [];
      }

      if (
        statement.includes("select s.user_id, u.email from user_sessions s")
        && statement.includes("join app_users u on u.id = s.user_id")
      ) {
        const session = state.sessions.get(String(params[0]));

        if (!session || session.expiresAt <= Date.now()) {
          return [];
        }

        const user = state.users.get(session.userId);

        return user
          ? [{ user_id: user.id, email: user.email }]
          : [];
      }

      if (statement === "update user_sessions set last_seen_at = now() where token_hash = $1") {
        return [];
      }

      if (
        statement
          === "select items, updated_at from user_cue_sheet_state where user_id = $1 limit 1"
      ) {
        const row = state.userCueSheets.get(String(params[0]));

        return row
          ? [{ items: clone(row.items), updated_at: row.updated_at }]
          : [];
      }

      if (
        statement.startsWith("insert into user_cue_sheet_state (user_id, items, updated_at)")
        && statement.includes("on conflict (user_id)")
      ) {
        const userId = String(params[0]);
        const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, ++state.writeCount));
        const items = JSON.parse(String(params[1]));

        state.userCueSheets.set(userId, {
          items: clone(items),
          updated_at: updatedAt,
        });

        return [{ updated_at: updatedAt }];
      }

      if (statement === "select items, updated_at from cue_sheet_state where id = $1 limit 1") {
        assert.equal(params[0], LEGACY_STORAGE_ROW_ID);

        return state.legacyCueSheet
          ? [{
            items: clone(state.legacyCueSheet.items),
            updated_at: state.legacyCueSheet.updated_at,
          }]
          : [];
      }

      if (
        statement.startsWith("insert into cue_sheet_state (id, items, updated_at)")
        && statement.includes("on conflict (id)")
      ) {
        assert.equal(params[0], LEGACY_STORAGE_ROW_ID);
        const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, 0, ++state.writeCount));

        state.legacyCueSheet = {
          items: JSON.parse(String(params[1])),
          updated_at: updatedAt,
        };

        return [{ updated_at: updatedAt }];
      }

      throw new Error(`Fake database received an unsupported query: ${statement}`);
    },
  };

  reset();

  return { reset, sql, state };
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

function createRequest(method, { body, token } = {}) {
  const headers = { host: "localhost" };

  if (token) {
    headers.cookie = `test_cookie=present; cue_sheet_session=${encodeURIComponent(token)}`;
  }

  return {
    body,
    headers,
    method,
  };
}

const database = createFakeDatabase();
const dbModulePath = require.resolve("../api/_lib/db");
const savePasswordModulePath = require.resolve("../api/_lib/save-password");
const routeModulePath = require.resolve("../api/_lib/routes/cues");
const originalDbModule = require.cache[dbModulePath];
const originalSavePasswordModule = require.cache[savePasswordModulePath];
const originalRouteModule = require.cache[routeModulePath];
const fakeDbModule = new Module(dbModulePath);
const fakeSavePasswordModule = new Module(savePasswordModulePath);

fakeDbModule.filename = dbModulePath;
fakeDbModule.loaded = true;
fakeDbModule.exports = {
  LEGACY_STORAGE_ROW_ID,
  ensureSchema: async () => {},
  getSql: () => database.sql,
};
fakeSavePasswordModule.filename = savePasswordModulePath;
fakeSavePasswordModule.loaded = true;
fakeSavePasswordModule.exports = {
  async validateSavePassword(sql, request, password) {
    if (password === "anonymous-secret") {
      return { ok: true };
    }

    return {
      ok: false,
      reset: false,
      message: "저장 비밀번호가 올바르지 않습니다.",
      attempts: 1,
      maxAttempts: 5,
      ip: "127.0.0.1",
    };
  },
};
require.cache[dbModulePath] = fakeDbModule;
require.cache[savePasswordModulePath] = fakeSavePasswordModule;
delete require.cache[routeModulePath];

const handleCues = require(routeModulePath);

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

  if (originalSavePasswordModule) {
    require.cache[savePasswordModulePath] = originalSavePasswordModule;
  } else {
    delete require.cache[savePasswordModulePath];
  }
});

async function requestCues(method, options) {
  const response = createResponse();

  await handleCues(createRequest(method, options), response);

  assert.notEqual(response.statusCode, undefined, "route must send an HTTP status");
  assert.notEqual(response.body, undefined, "route must send a JSON body");

  return response;
}

function titles(response) {
  assert.ok(Array.isArray(response.body.items), "response items must be an array");

  return response.body.items.map((item) => item.title);
}

function assertAuthenticatedScope(response, user) {
  assert.equal(response.body.authenticated, true);
  assert.equal(response.body.userScoped, true);
  assert.equal(typeof response.body.userId, "string");
  assert.equal(response.body.userId, String(user.id));
}

function assertAnonymousScope(response) {
  assert.equal(response.body.authenticated, false);
  assert.equal(response.body.userScoped, false);
  assert.equal(response.body.userId, null);
}

test("A와 B는 위조 payload와 덮어쓰기에도 각자의 큐시트만 저장하고 조회한다", async () => {
  database.reset();

  const saveA = await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      userId: String(USER_B.id),
      items: [cue("A 첫 큐", "a-first")],
    },
  });

  assert.equal(saveA.statusCode, 200);
  assertAuthenticatedScope(saveA, USER_A);
  assert.deepEqual(titles(saveA), ["A 첫 큐"]);
  assert.deepEqual(
    database.state.userCueSheets.get(String(USER_A.id)).items.map((item) => item.title),
    ["A 첫 큐"],
  );
  assert.equal(
    database.state.userCueSheets.has(String(USER_B.id)),
    false,
    "payload.userId must never choose the database owner",
  );

  const emptyB = await requestCues("GET", { token: SESSION_B });

  assert.equal(emptyB.statusCode, 200);
  assertAuthenticatedScope(emptyB, USER_B);
  assert.deepEqual(titles(emptyB), []);

  const saveB = await requestCues("PUT", {
    token: SESSION_B,
    body: {
      expectedUserId: String(USER_B.id),
      items: [cue("B 전용 큐", "b-only")],
    },
  });

  assert.equal(saveB.statusCode, 200);
  assertAuthenticatedScope(saveB, USER_B);

  const [readA, readB] = await Promise.all([
    requestCues("GET", { token: SESSION_A }),
    requestCues("GET", { token: SESSION_B }),
  ]);

  assert.deepEqual(titles(readA), ["A 첫 큐"]);
  assert.deepEqual(titles(readB), ["B 전용 큐"]);
  assertAuthenticatedScope(readA, USER_A);
  assertAuthenticatedScope(readB, USER_B);

  const overwriteA = await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      items: [cue("A 수정 큐", "a-updated")],
    },
  });

  assert.equal(overwriteA.statusCode, 200);
  assert.deepEqual(titles(overwriteA), ["A 수정 큐"]);
  assert.deepEqual(
    titles(await requestCues("GET", { token: SESSION_B })),
    ["B 전용 큐"],
    "overwriting A must not change B",
  );

  const clearA = await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      items: [],
    },
  });

  assert.equal(clearA.statusCode, 200);
  assert.deepEqual(titles(clearA), []);
  assert.deepEqual(titles(await requestCues("GET", { token: SESSION_A })), []);
  assert.deepEqual(
    titles(await requestCues("GET", { token: SESSION_B })),
    ["B 전용 큐"],
    "clearing A must not clear B",
  );
});

test("expectedUserId 불일치와 배열이 아닌 items는 4xx이며 저장 상태를 바꾸지 않는다", async () => {
  database.reset();

  const initialSave = await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      items: [cue("A 보존 큐", "a-preserved")],
    },
  });

  assert.equal(initialSave.statusCode, 200);

  const writesBeforeMismatch = database.state.writeCount;
  const mismatch = await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_B.id),
      userId: String(USER_B.id),
      items: [cue("침범 시도", "intrusion")],
    },
  });

  assert.equal(mismatch.statusCode, 409);
  assert.equal(mismatch.body.error, "session_changed");
  assertAuthenticatedScope(mismatch, USER_A);
  assert.equal(database.state.writeCount, writesBeforeMismatch);
  assert.deepEqual(
    titles(await requestCues("GET", { token: SESSION_A })),
    ["A 보존 큐"],
  );
  assert.deepEqual(titles(await requestCues("GET", { token: SESSION_B })), []);

  for (const [label, body] of [
    ["expectedUserId 누락", { items: [cue("누락 침범", "missing-owner")] }],
    ["expectedUserId 숫자형", {
      expectedUserId: USER_A.id,
      items: [cue("숫자형 침범", "numeric-owner")],
    }],
  ]) {
    const guarded = await requestCues("PUT", {
      token: SESSION_A,
      body,
    });

    assert.equal(guarded.statusCode, 409, label);
    assert.equal(guarded.body.error, "session_changed", label);
    assertAuthenticatedScope(guarded, USER_A);
    assert.equal(database.state.writeCount, writesBeforeMismatch, label);
  }

  const staleAccountScreen = await requestCues("PUT", {
    token: SESSION_B,
    body: {
      expectedUserId: String(USER_A.id),
      items: [cue("A 화면에서 B 쿠키", "stale-account")],
    },
  });

  assert.equal(staleAccountScreen.statusCode, 409);
  assert.equal(staleAccountScreen.body.error, "session_changed");
  assertAuthenticatedScope(staleAccountScreen, USER_B);
  assert.equal(database.state.writeCount, writesBeforeMismatch);

  const writesBeforeInvalidItems = database.state.writeCount;
  const invalidItems = await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      items: { title: "배열이 아님" },
    },
  });

  assert.equal(invalidItems.statusCode, 400);
  assert.equal(database.state.writeCount, writesBeforeInvalidItems);
  assert.deepEqual(
    titles(await requestCues("GET", { token: SESSION_A })),
    ["A 보존 큐"],
    "invalid items must not normalize to an accidental empty overwrite",
  );

  const writesBeforeInvalidEntry = database.state.writeCount;
  const invalidEntry = await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      items: [{}],
    },
  });

  assert.equal(invalidEntry.statusCode, 400);
  assert.equal(database.state.writeCount, writesBeforeInvalidEntry);
  assert.deepEqual(
    titles(await requestCues("GET", { token: SESSION_A })),
    ["A 보존 큐"],
    "invalid entries must not be dropped into an accidental empty overwrite",
  );
});

test("쿠키 없음, 무효 쿠키, 만료 쿠키는 개인 큐시트를 노출하지 않는다", async () => {
  database.reset();

  await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      items: [cue("A 비공개 큐", "a-private")],
    },
  });
  await requestCues("PUT", {
    token: SESSION_B,
    body: {
      expectedUserId: String(USER_B.id),
      items: [cue("B 비공개 큐", "b-private")],
    },
  });

  for (const [label, token] of [
    ["쿠키 없음", undefined],
    ["무효 쿠키", "not-a-real-session"],
    ["만료 쿠키", EXPIRED_SESSION],
  ]) {
    const response = await requestCues("GET", { token });

    assert.equal(response.statusCode, 200, label);
    assertAnonymousScope(response);
    assert.deepEqual(titles(response), ["공용 익명 큐"], label);
    assert.equal(titles(response).includes("A 비공개 큐"), false, label);
    assert.equal(titles(response).includes("B 비공개 큐"), false, label);
  }
});

test("익명 저장은 공용 행만 바꾸고 인증 회원의 개인 행은 유지한다", async () => {
  database.reset();

  await requestCues("PUT", {
    token: SESSION_A,
    body: {
      expectedUserId: String(USER_A.id),
      items: [cue("A 비공개 보존", "a-private-preserved")],
    },
  });

  const invalidPassword = await requestCues("PUT", {
    body: {
      password: "wrong-password",
      items: [cue("저장되면 안 됨", "invalid-anonymous-save")],
    },
  });

  assert.equal(invalidPassword.statusCode, 401);
  assertAnonymousScope(invalidPassword);
  assert.deepEqual(
    database.state.legacyCueSheet.items.map((item) => item.title),
    ["공용 익명 큐"],
  );

  const saveAnonymous = await requestCues("PUT", {
    body: {
      password: "anonymous-secret",
      items: [cue("새 공용 큐", "new-public")],
    },
  });

  assert.equal(saveAnonymous.statusCode, 200);
  assertAnonymousScope(saveAnonymous);
  assert.deepEqual(titles(saveAnonymous), ["새 공용 큐"]);
  assert.deepEqual(
    titles(await requestCues("GET", { token: SESSION_A })),
    ["A 비공개 보존"],
  );

  const clearAnonymous = await requestCues("PUT", {
    body: {
      password: "anonymous-secret",
      items: [],
    },
  });

  assert.equal(clearAnonymous.statusCode, 200);
  assertAnonymousScope(clearAnonymous);
  assert.deepEqual(titles(clearAnonymous), []);
  assert.deepEqual(
    titles(await requestCues("GET", { token: SESSION_A })),
    ["A 비공개 보존"],
  );
});

test("A와 B의 동시 저장도 사용자별 행으로 분리된다", async () => {
  database.reset();

  const [saveA, saveB] = await Promise.all([
    requestCues("PUT", {
      token: SESSION_A,
      body: {
        expectedUserId: String(USER_A.id),
        items: [cue("A 동시 저장", "a-concurrent")],
      },
    }),
    requestCues("PUT", {
      token: SESSION_B,
      body: {
        expectedUserId: String(USER_B.id),
        items: [cue("B 동시 저장", "b-concurrent")],
      },
    }),
  ]);

  assert.equal(saveA.statusCode, 200);
  assert.equal(saveB.statusCode, 200);
  assertAuthenticatedScope(saveA, USER_A);
  assertAuthenticatedScope(saveB, USER_B);

  const [readA, readB] = await Promise.all([
    requestCues("GET", { token: SESSION_A }),
    requestCues("GET", { token: SESSION_B }),
  ]);

  assert.deepEqual(titles(readA), ["A 동시 저장"]);
  assert.deepEqual(titles(readB), ["B 동시 저장"]);
});
