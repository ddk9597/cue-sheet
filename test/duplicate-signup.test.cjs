const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { after, test } = require("node:test");

const actualAuth = require("../api/_lib/auth");

function compactSql(query) {
  return String(query).replace(/\s+/g, " ").trim().toLowerCase();
}

function validSignupPayload() {
  return {
    email: "member@example.com",
    name: "회원",
    birthDate: "2000-01-01",
    phone: "01012345678",
    memo: "",
    region: "서울",
    position: "기타",
    genre: "록",
    password: "password1",
  };
}

test("이미 가입이 완료된 이메일은 인증 세션을 다시 생성하지 않는다", async () => {
  for (const existingUser of [
    { id: 1, email: "member@example.com", google_sub: null, password_hash: "password-hash" },
    { id: 2, email: "member@example.com", google_sub: "google-sub", password_hash: "" },
  ]) {
    let queryCount = 0;
    const sql = {
      async query(statement, params = []) {
        queryCount += 1;
        assert.match(compactSql(statement), /^select id, email, google_sub, password_hash from app_users/);
        assert.deepEqual(params, ["member@example.com"]);
        return [existingUser];
      },
    };

    await assert.rejects(
      actualAuth.findOrCreateEmailUser(sql, " MEMBER@EXAMPLE.COM "),
      (error) => error.statusCode === 409
        && error.code === "email_already_registered"
        && /이미 가입된/.test(error.message),
    );
    assert.equal(queryCount, 1);
  }
});

test("동시 인증 중 다른 가입이 먼저 완료되어도 중복 계정을 사용하지 않는다", async () => {
  let selectCount = 0;
  const sql = {
    async query(statement) {
      const query = compactSql(statement);

      if (query.startsWith("select id, email, google_sub, password_hash from app_users")) {
        selectCount += 1;
        return selectCount === 1
          ? []
          : [{
            id: 3,
            email: "member@example.com",
            google_sub: null,
            password_hash: "concurrent-password-hash",
          }];
      }

      if (query.startsWith("insert into app_users")) {
        assert.match(query, /on conflict \(email\) do nothing/);
        return [];
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };

  await assert.rejects(
    actualAuth.findOrCreateEmailUser(sql, "member@example.com"),
    (error) => error.statusCode === 409 && error.code === "email_already_registered",
  );
  assert.equal(selectCount, 2);
});

test("가입 정보 저장은 미완료 계정에만 한 번 적용된다", async () => {
  let updateStatement = "";
  const sql = {
    async query(statement) {
      const query = compactSql(statement);

      if (query.startsWith("update app_users")) {
        updateStatement = query;
        return [];
      }

      if (query.startsWith("select id, google_sub, password_hash from app_users")) {
        return [{ id: 4, google_sub: null, password_hash: "existing-password-hash" }];
      }

      throw new Error(`Unexpected query: ${query}`);
    },
  };

  await assert.rejects(
    actualAuth.updateEmailUserSignup(sql, 4, validSignupPayload()),
    (error) => error.statusCode === 409 && error.code === "email_already_registered",
  );
  assert.match(updateStatement, /where id = \$1 and password_hash = ''/);
  assert.match(updateStatement, /coalesce\(google_sub, ''\) = ''/);
});

const dbModulePath = require.resolve("../api/_lib/db");
const routeModulePath = require.resolve("../api/_lib/routes/auth");
const originalDbModule = require.cache[dbModulePath];
const originalRouteModule = require.cache[routeModulePath];
const originalSmtpEnv = {
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_USER: process.env.SMTP_USER,
};

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

  for (const [name, value] of Object.entries(originalSmtpEnv)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

test("인증코드 발송 전에 기존 회원을 409로 차단한다", async () => {
  const queries = [];
  const sql = {
    async query(statement, params = []) {
      const query = compactSql(statement);
      queries.push(query);
      assert.match(query, /^select id from app_users/);
      assert.deepEqual(params, ["member@example.com"]);
      return [{ id: 5 }];
    },
  };
  const fakeDbModule = new Module(dbModulePath);

  fakeDbModule.filename = dbModulePath;
  fakeDbModule.loaded = true;
  fakeDbModule.exports = {
    ensureSchema: async () => {},
    getSql: () => sql,
  };
  require.cache[dbModulePath] = fakeDbModule;
  delete require.cache[routeModulePath];

  process.env.SMTP_USER = "smtp@example.com";
  process.env.SMTP_PASS = "smtp-password";
  process.env.SMTP_FROM = "smtp@example.com";

  const handleAuth = require(routeModulePath);
  const response = createResponse();

  await handleAuth({
    body: { email: " MEMBER@EXAMPLE.COM " },
    headers: { host: "localhost" },
    method: "POST",
    query: { path: ["auth", "email", "start"] },
    url: "/api/auth/email/start",
  }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, "email_already_registered");
  assert.match(response.body.message, /로그인/);
  assert.equal(queries.length, 1);
});

test("회원가입 화면은 중복 응답을 받으면 이전 이메일 인증 상태를 폐기한다", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "signup.html"), "utf8");

  assert.match(source, /payload\?\.error === ["']email_already_registered["']/);
  assert.match(source, /signupState\.emailVerification = null/);
  assert.match(source, /handleSignupRequestError\(payload/);
});

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
