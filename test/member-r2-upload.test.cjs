const assert = require("node:assert/strict");
const Module = require("node:module");
const { after, before, beforeEach, test } = require("node:test");

const authPath = require.resolve("../api/_lib/auth");
const dbPath = require.resolve("../api/_lib/db");
const groupsPath = require.resolve("../api/_lib/routes/groups");
const memberPath = require.resolve("../api/_lib/routes/member");
const r2Path = require.resolve("../api/_lib/r2");
const actualAuth = require(authPath);
const actualR2 = require(r2Path);
const originalCacheEntries = new Map(
  [authPath, dbPath, groupsPath, memberPath, r2Path]
    .map((modulePath) => [modulePath, require.cache[modulePath]]),
);
const originalPublicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
const USER = Object.freeze({ id: 73, email: "member@example.com" });
const UUID_NEW = "123e4567-e89b-42d3-a456-426614174000";
const UUID_OLD = "223e4567-e89b-42d3-a456-426614174001";
const UUID_SECOND = "323e4567-e89b-42d3-a456-426614174002";
const NEW_KEY = `users/${USER.id}/images/2026/07/${UUID_NEW}.webp`;
const OLD_KEY = `users/${USER.id}/images/2026/06/${UUID_OLD}.webp`;
const SECOND_KEY = `users/${USER.id}/images/2026/07/${UUID_SECOND}.webp`;
const OTHER_USER_KEY = `users/999/images/2026/07/${UUID_NEW}.webp`;
const DISPLAY_BASE_URL = "https://images.example.test";
let handleMember;
let handleGroups;
let state;

const sql = {
  transaction(createQueries) {
    const run = async () => {
      state.transactionCalls += 1;
      const txn = {
        query(statement, params = []) {
          return { params, statement };
        },
      };
      const queries = createQueries(txn);
      const results = [];

      for (const query of queries) {
        results.push(await sql.query(query.statement, query.params));
      }

      return results;
    };
    const result = state.transactionQueue.then(run, run);

    state.transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  },
  async query(statement, params = []) {
    const normalized = normalizeSql(statement);

    if (normalized.startsWith("select email, name, picture_url, picture_key, pending_picture_key")) {
      state.events.push(`db:select:${state.current.pictureKey || "none"}`);
      state.lastImageSelect = normalized;

      if (state.dbSelectError) {
        throw state.dbSelectError;
      }

      return state.memberExists ? [profileRow()] : [];
    }

    if (normalized.startsWith("select picture_key, picture_url, pending_picture_key from app_users")) {
      state.events.push(`db:select:${state.current.pictureKey || "none"}`);
      state.lastImageSelect = normalized;

      if (state.dbSelectError) {
        throw state.dbSelectError;
      }

      return state.memberExists
        ? [{
            picture_key: state.current.pictureKey,
            picture_url: state.current.pictureUrl,
            pending_picture_key: state.current.pendingPictureKey,
          }]
        : [];
    }

    if (normalized.startsWith("update app_users set pending_picture_key = $2")) {
      state.events.push(`db:presign-pending:${params[1]}`);
      state.lastPendingUpdate = { statement: normalized, params: [...params] };

      if (state.pendingUpdateError) {
        throw state.pendingUpdateError;
      }

      if (!state.memberExists) {
        return [];
      }

      state.current.pendingPictureKey = String(params[1]);
      return [{ id: USER.id }];
    }

    if (normalized.startsWith("update app_users set pending_picture_key = ''")) {
      state.events.push(`db:release:${params[1]}`);
      state.lastPendingRelease = { statement: normalized, params: [...params] };

      if (state.cleanupReleaseError) {
        throw state.cleanupReleaseError;
      }

      if (
        !state.memberExists
        || state.current.pendingPictureKey !== String(params[1])
        || state.current.pictureKey === String(params[1])
      ) {
        return [];
      }

      state.current.pendingPictureKey = "";
      return [{ id: USER.id }];
    }

    if (normalized.startsWith("update app_users set picture_key = $2, pending_picture_key = '', picture_url = ''")) {
      state.events.push(`db:update:${params[1]}`);
      state.lastImageUpdate = { statement: normalized, params: [...params] };

      if (state.dbUpdateError) {
        throw state.dbUpdateError;
      }

      if (!state.memberExists || state.current.pendingPictureKey !== String(params[1])) {
        return [];
      }

      state.current.pictureKey = String(params[1]);
      state.current.pendingPictureKey = "";
      state.current.pictureUrl = "";
      return [profileRow()];
    }

    if (normalized.startsWith("update app_users set picture_key = '', pending_picture_key = '', picture_url = ''")) {
      state.events.push("db:delete-picture");

      if (!state.memberExists) {
        return [];
      }

      state.current.pictureKey = "";
      state.current.pendingPictureKey = "";
      state.current.pictureUrl = "";
      return [profileRow()];
    }

    if (normalized.startsWith("update app_users set name = $2")) {
      state.events.push("db:update-profile");
      state.lastProfileUpdate = { statement: normalized, params: [...params] };
      state.profile.name = String(params[1]);
      state.profile.region = String(params[2]);
      state.profile.position = String(params[3]);
      state.profile.genre = String(params[4]);
      state.profile.memo = String(params[5]);
      return [profileRow()];
    }

    if (normalized.startsWith("select email, name, picture_url, picture_key")) {
      return [profileRow()];
    }

    if (normalized.startsWith("select id, name, picture_url, picture_key")) {
      return [{ id: USER.id, ...profileRow(), last_login_at: new Date("2026-07-17T00:00:00Z") }];
    }

    if (normalized.includes("from groups g left join group_members gm")) {
      return [{
        id: 5,
        name: "테스트 그룹",
        description: "",
        owner_user_id: USER.id,
        role: "owner",
        member_count: 2,
        created_at: null,
        updated_at: null,
      }];
    }

    if (normalized.startsWith("select u.id, u.email, u.name, u.picture_url, u.picture_key")) {
      return [
        {
          id: USER.id,
          email: USER.email,
          name: "키 회원",
          picture_key: state.current.pictureKey,
          picture_url: state.current.pictureUrl,
          region: "서울",
          position: "기타",
          genre: "록",
          role: "owner",
          created_at: null,
        },
        {
          id: 74,
          email: "legacy@example.com",
          name: "레거시 회원",
          picture_key: "",
          picture_url: "https://legacy.example/profile.png",
          region: "부산",
          position: "보컬",
          genre: "재즈",
          role: "member",
          created_at: null,
        },
      ];
    }

    throw new Error(`Unexpected member R2 test query: ${normalized}`);
  },
};

before(() => {
  process.env.R2_PUBLIC_BASE_URL = DISPLAY_BASE_URL;

  installFakeModule(dbPath, {
    ensureSchema: async (receivedSql) => {
      assert.strictEqual(receivedSql, sql);
      state.ensureCalls += 1;
    },
    getSql: () => sql,
  });
  installFakeModule(authPath, {
    ...actualAuth,
    getSessionUser: async (receivedSql) => {
      assert.strictEqual(receivedSql, sql);
      state.sessionCalls += 1;
      return state.sessionUser;
    },
  });
  installFakeModule(r2Path, {
    ...actualR2,
    createPresignedImageUpload: async (input) => {
      state.events.push(`presign:${input.contentType}`);
      state.presignInput = input;

      if (state.presignError) throw state.presignError;

      return {
        uploadUrl: "https://upload.example.test/temporary-signature",
        objectKey: NEW_KEY.replace(/\.webp$/, extensionForContentType(input.contentType)),
      };
    },
    deleteImageObject: async (objectKey) => {
      state.events.push(`delete:${objectKey}`);
      if (state.deleteErrorKeys.has(objectKey)) throw new Error("storage delete failed");
    },
    getR2Storage: () => {
      state.events.push("storage:config");
      return { bucket: "test-bucket", client: {} };
    },
    headImageObject: async (objectKey) => {
      state.events.push(`head:${objectKey}`);
      if (state.headError) throw state.headError;
      return state.headResult;
    },
  });

  delete require.cache[memberPath];
  delete require.cache[groupsPath];
  handleMember = require(memberPath);
  handleGroups = require(groupsPath);
});

after(() => {
  for (const [modulePath, originalEntry] of originalCacheEntries) {
    if (originalEntry) {
      require.cache[modulePath] = originalEntry;
    } else {
      delete require.cache[modulePath];
    }
  }

  if (originalPublicBaseUrl === undefined) {
    delete process.env.R2_PUBLIC_BASE_URL;
  } else {
    process.env.R2_PUBLIC_BASE_URL = originalPublicBaseUrl;
  }
});

beforeEach(() => {
  state = {
    current: {
      pendingPictureKey: NEW_KEY,
      pictureKey: OLD_KEY,
      pictureUrl: "",
    },
    cleanupReleaseError: null,
    dbUpdateError: null,
    dbSelectError: null,
    deleteErrorKeys: new Set(),
    ensureCalls: 0,
    events: [],
    headError: null,
    headResult: {
      ContentLength: 1024,
      ContentType: "image/webp",
    },
    lastImageUpdate: null,
    lastImageSelect: "",
    lastPendingRelease: null,
    lastPendingUpdate: null,
    lastProfileUpdate: null,
    memberExists: true,
    pendingUpdateError: null,
    presignError: null,
    presignInput: null,
    profile: {
      email: USER.email,
      name: "회원",
      region: "서울",
      position: "기타",
      genre: "록",
      memo: "",
    },
    sessionCalls: 0,
    sessionUser: USER,
    transactionCalls: 0,
    transactionQueue: Promise.resolve(),
  };
});

test("비로그인 사용자는 Presigned URL과 완료 검증을 호출할 수 없다", async () => {
  state.sessionUser = null;

  for (const route of ["uploads/presign", "uploads/complete"]) {
    const result = await requestMember(route, "POST", {
      contentType: "image/webp",
      size: 100,
      purpose: "profile",
      objectKey: NEW_KEY,
    });

    assert.equal(result.statusCode, 401);
    assert.equal(result.body.error, "not_authenticated");
  }

  assert.deepEqual(state.events, []);
});

test("Presign 응답은 uploadUrl과 서버 생성 objectKey만 반환한다", async () => {
  state.current.pendingPictureKey = SECOND_KEY;

  const result = await requestMember("uploads/presign", "POST", {
    fileName: "../../foreign-user/private.webp",
    contentType: "image/webp",
    size: 1024,
    purpose: "profile",
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, {
    uploadUrl: "https://upload.example.test/temporary-signature",
    objectKey: NEW_KEY,
  });
  assert.deepEqual(Object.keys(result.body).sort(), ["objectKey", "uploadUrl"]);
  assert.deepEqual(state.presignInput, { userId: USER.id, contentType: "image/webp", size: 1024 });
  assert.deepEqual(state.lastPendingUpdate.params, [USER.id, NEW_KEY]);
  assert.equal(state.current.pendingPictureKey, NEW_KEY);
  assert.equal(result.body.objectKey.includes("foreign-user"), false);
  assert.deepEqual(state.events, [
    "presign:image/webp",
    `db:presign-pending:${NEW_KEY}`,
  ]);
});

test("Presign pending DB 기록이 실패하면 업로드 주소를 반환하지 않는다", async () => {
  state.current.pendingPictureKey = SECOND_KEY;
  state.pendingUpdateError = new Error("database unavailable");

  const result = await withoutConsoleError(
    () => requestMember("uploads/presign", "POST", {
      contentType: "image/webp",
      size: 1024,
      purpose: "profile",
    }),
  );

  assert.equal(result.statusCode, 500);
  assert.equal(result.body.error, "upload_record_db_save_failed");
  assert.equal(state.current.pendingPictureKey, SECOND_KEY);
  assert.equal("uploadUrl" in result.body, false);
  assert.equal("objectKey" in result.body, false);
});

test("Presign은 잘못된 MIME, 크기, 목적을 signer 호출 전에 차단한다", async () => {
  const cases = [
    [{ contentType: "image/gif", size: 1, purpose: "profile" }, "unsupported_image_type", 400],
    [{ contentType: "image/png", size: 0, purpose: "profile" }, "invalid_image_size", 400],
    [{ contentType: "image/png", size: 5 * 1024 * 1024 + 1, purpose: "profile" }, "image_too_large", 413],
    [{ contentType: "image/png", size: 1, purpose: "album" }, "invalid_upload_purpose", 400],
  ];

  for (const [body, errorCode, statusCode] of cases) {
    const result = await requestMember("uploads/presign", "POST", body);

    assert.equal(result.statusCode, statusCode);
    assert.equal(result.body.error, errorCode);
  }

  assert.equal(state.events.some((event) => event.startsWith("presign:")), false);
  assert.equal(state.events.some((event) => event.startsWith("db:presign-pending:")), false);
});

test("complete는 타 사용자의 objectKey를 Head 요청 전에 차단한다", async () => {
  const result = await requestMember("uploads/complete", "POST", { objectKey: OTHER_USER_KEY });

  assert.equal(result.statusCode, 403);
  assert.equal(result.body.error, "upload_object_not_owned");
  assert.equal(state.events.some((event) => event.startsWith("head:")), false);
  assert.equal(state.events.some((event) => event.startsWith("db:")), false);
});

test("complete는 Head 검증 후 objectKey만 DB에 저장하고 기존 객체를 나중에 삭제한다", async () => {
  const result = await requestMember("uploads/complete", "POST", { objectKey: NEW_KEY });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.objectKey, NEW_KEY);
  assert.equal(result.body.displayUrl, `${DISPLAY_BASE_URL}/${NEW_KEY}`);
  assert.equal(result.body.profile.pictureKey, NEW_KEY);
  assert.equal(result.body.profile.pictureUrl, `${DISPLAY_BASE_URL}/${NEW_KEY}`);
  assert.deepEqual(state.lastImageUpdate.params, [USER.id, NEW_KEY]);
  assert.equal(state.current.pendingPictureKey, "");
  assert.equal(state.transactionCalls, 1);
  assert.match(state.lastImageSelect, /for update$/);
  assert.match(state.lastImageSelect, /pending_picture_key/);
  assert.match(state.lastImageUpdate.statement, /where id = \$1 and pending_picture_key = \$2/);
  assert.match(state.lastImageUpdate.statement, /returning email/);
  assert.equal(state.lastImageUpdate.params.some((value) => String(value).includes("https://")), false);
  assert.deepEqual(
    state.events.filter((event) => /^(head|db|delete):/.test(event)),
    [
      `head:${NEW_KEY}`,
      `db:select:${OLD_KEY}`,
      `db:update:${NEW_KEY}`,
      `delete:${OLD_KEY}`,
    ],
  );
});

test("신규 complete와 기존 key 재생을 직렬화해 이전 key가 다시 활성화되지 않는다", async () => {
  const [replacement, replay] = await Promise.all([
    requestMember("uploads/complete", "POST", { objectKey: NEW_KEY }),
    requestMember("uploads/complete", "POST", { objectKey: OLD_KEY }),
  ]);

  assert.equal(replacement.statusCode, 200);
  assert.ok([200, 409].includes(replay.statusCode));
  assert.equal(state.current.pictureKey, NEW_KEY);
  assert.equal(state.current.pendingPictureKey, "");
  assert.equal(state.transactionCalls, 2);
  assert.ok(state.events.includes(`delete:${OLD_KEY}`));
  assert.equal(state.events.includes(`delete:${NEW_KEY}`), false);
});

test("현재 picture_key의 complete 재시도는 pending이 없어도 멱등 성공한다", async () => {
  state.current.pictureKey = NEW_KEY;
  state.current.pendingPictureKey = "";

  const result = await requestMember("uploads/complete", "POST", { objectKey: NEW_KEY });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.profile.pictureKey, NEW_KEY);
  assert.equal(state.current.pictureKey, NEW_KEY);
  assert.equal(state.current.pendingPictureKey, "");
  assert.equal(state.events.includes(`delete:${NEW_KEY}`), false);
});

test("교체된 key의 complete 재시도는 거부하고 현재 key를 유지한다", async () => {
  state.current.pictureKey = SECOND_KEY;
  state.current.pendingPictureKey = "";

  const result = await requestMember("uploads/complete", "POST", { objectKey: NEW_KEY });

  assert.equal(result.statusCode, 409);
  assert.equal(result.body.error, "upload_record_not_pending");
  assert.equal(state.current.pictureKey, SECOND_KEY);
  assert.equal(state.current.pendingPictureKey, "");
  assert.ok(state.events.includes(`delete:${NEW_KEY}`));
  assert.equal(state.events.includes(`delete:${SECOND_KEY}`), false);
});

test("complete는 누락 객체와 잘못된 실제 메타데이터를 DB 저장 전에 거부한다", async () => {
  state.headError = { name: "NotFound", $metadata: { httpStatusCode: 404 } };
  let result = await requestMember("uploads/complete", "POST", { objectKey: NEW_KEY });

  assert.equal(result.statusCode, 404);
  assert.equal(result.body.error, "uploaded_image_not_found");
  assert.ok(state.events.includes(`db:release:${NEW_KEY}`));
  assert.equal(state.current.pendingPictureKey, "");
  assert.equal(state.lastImageUpdate, null);

  state.events = [];
  state.current.pendingPictureKey = NEW_KEY;
  state.headError = null;
  state.headResult = { ContentLength: 5 * 1024 * 1024 + 1, ContentType: "image/webp" };
  result = await requestMember("uploads/complete", "POST", { objectKey: NEW_KEY });

  assert.equal(result.statusCode, 422);
  assert.equal(result.body.error, "uploaded_image_too_large");
  assert.ok(state.events.includes(`db:release:${NEW_KEY}`));
  assert.ok(state.events.includes(`delete:${NEW_KEY}`));
  assert.equal(state.current.pendingPictureKey, "");
  assert.equal(state.lastImageUpdate, null);

  state.events = [];
  state.current.pendingPictureKey = NEW_KEY;
  state.headResult = { ContentLength: 10, ContentType: "image/png" };
  result = await requestMember("uploads/complete", "POST", { objectKey: NEW_KEY });

  assert.equal(result.statusCode, 422);
  assert.equal(result.body.error, "uploaded_image_type_mismatch");
  assert.ok(state.events.includes(`db:release:${NEW_KEY}`));
  assert.ok(state.events.includes(`delete:${NEW_KEY}`));
  assert.equal(state.current.pendingPictureKey, "");
  assert.equal(state.lastImageUpdate, null);
});

test("DB 저장 실패 시 신규 객체를 삭제하고 기존 객체는 유지한다", async () => {
  state.dbUpdateError = new Error("database unavailable");

  const result = await withoutConsoleError(
    () => requestMember("uploads/complete", "POST", { objectKey: NEW_KEY }),
  );

  assert.equal(result.statusCode, 500);
  assert.equal(result.body.error, "profile_image_db_save_failed");
  assert.ok(state.events.includes(`db:release:${NEW_KEY}`));
  assert.ok(state.events.includes(`delete:${NEW_KEY}`));
  assert.equal(state.events.includes(`delete:${OLD_KEY}`), false);
  assert.equal(state.current.pendingPictureKey, "");
});

test("DB 현재 key 조회가 실패해도 DB 오류로 구분하고 신규 객체 정리를 시도한다", async () => {
  state.dbSelectError = new Error("database read unavailable");

  const result = await withoutConsoleError(
    () => requestMember("uploads/complete", "POST", { objectKey: NEW_KEY }),
  );

  assert.equal(result.statusCode, 500);
  assert.equal(result.body.error, "profile_image_db_save_failed");
  assert.ok(state.events.includes(`db:release:${NEW_KEY}`));
  assert.ok(state.events.includes(`delete:${NEW_KEY}`));
  assert.equal(state.events.includes(`delete:${OLD_KEY}`), false);
  assert.equal(state.current.pendingPictureKey, "");
});

test("기존 객체 삭제 실패는 신규 DB 저장 성공을 되돌리지 않는다", async () => {
  state.deleteErrorKeys.add(OLD_KEY);

  const result = await withoutConsoleError(
    () => requestMember("uploads/complete", "POST", { objectKey: NEW_KEY }),
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.profile.pictureKey, NEW_KEY);
  assert.ok(state.events.includes(`delete:${OLD_KEY}`));
});

test("일반 profile PUT은 클라이언트 pictureUrl을 저장하지 않고 기존 key를 보존한다", async () => {
  const result = await requestMember("profile", "PUT", {
    name: "수정 회원",
    region: "부산",
    position: "보컬",
    genre: "재즈",
    memo: "메모",
    pictureUrl: "https://attacker.example/override.png",
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.profile.pictureKey, OLD_KEY);
  assert.equal(result.body.profile.pictureUrl, `${DISPLAY_BASE_URL}/${OLD_KEY}`);
  assert.deepEqual(state.lastProfileUpdate.params, [USER.id, "수정 회원", "부산", "보컬", "재즈", "메모"]);
  assert.equal(state.lastProfileUpdate.statement.includes("picture_url ="), false);
  assert.equal(state.lastProfileUpdate.statement.includes("picture_key ="), false);
});

test("profile과 directory 응답은 picture_key 표시 URL과 legacy URL fallback을 구분한다", async () => {
  let result = await requestMember("profile", "GET");

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.profile.pictureKey, OLD_KEY);
  assert.equal(result.body.profile.pictureUrl, `${DISPLAY_BASE_URL}/${OLD_KEY}`);

  state.current.pictureKey = "";
  state.current.pictureUrl = "https://legacy.example/profile.png";
  result = await requestMember("directory", "GET");

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.members[0].pictureUrl, "https://legacy.example/profile.png");
});

test("그룹 멤버 응답도 picture_key를 공개 URL로 조합하고 legacy URL은 fallback한다", async () => {
  const result = await requestGroups("5/members", "GET");

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.members[0].pictureUrl, `${DISPLAY_BASE_URL}/${OLD_KEY}`);
  assert.equal(result.body.members[1].pictureUrl, "https://legacy.example/profile.png");
});

test("기존 profile-image 경로는 DELETE만 허용하고 key 기반으로 제거한다", async () => {
  let result = await requestMember("profile-image", "POST", { dataUrl: "data:image/webp;base64,AAAA" });

  assert.equal(result.statusCode, 405);

  state.events = [];
  result = await requestMember("profile-image", "DELETE");

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.profile.pictureKey, "");
  assert.equal(result.body.profile.pictureUrl, "");
  assert.equal(state.current.pendingPictureKey, "");
  assert.deepEqual(
    state.events.filter((event) => /^(db|delete|storage):/.test(event)),
    [
      `db:select:${OLD_KEY}`,
      "storage:config",
      `db:select:${OLD_KEY}`,
      "db:delete-picture",
      `delete:${OLD_KEY}`,
      `delete:${NEW_KEY}`,
    ],
  );
});

test("profile-image DELETE와 complete가 겹쳐도 DB에서 제거된 새 객체를 R2에 남기지 않는다", async () => {
  const [completeResult, deleteResult] = await Promise.all([
    requestMember("uploads/complete", "POST", { objectKey: NEW_KEY }),
    requestMember("profile-image", "DELETE"),
  ]);

  assert.ok([200, 409].includes(completeResult.statusCode));
  assert.equal(deleteResult.statusCode, 200);
  assert.equal(state.current.pictureKey, "");
  assert.equal(state.current.pendingPictureKey, "");
  assert.ok(state.events.includes(`delete:${OLD_KEY}`));
  assert.ok(state.events.includes(`delete:${NEW_KEY}`));
});

test("이메일 가입 저장은 payload의 전체 이미지 URL을 DB에 기록하지 않는다", async () => {
  let capturedStatement = "";
  let capturedParams = [];
  const signupSql = {
    async query(statement, params) {
      capturedStatement = normalizeSql(statement);
      capturedParams = [...params];
      return [{ id: USER.id, email: USER.email }];
    },
  };

  await actualAuth.updateEmailUserSignup(signupSql, USER.id, {
    email: USER.email,
    name: "회원",
    birthDate: "2000-01-01",
    phone: "01012345678",
    memo: "",
    region: "서울",
    position: "기타",
    genre: "록",
    pictureUrl: "https://images.example.test/should-not-be-saved.webp",
    password: "password1",
  });

  assert.equal(capturedStatement.includes("picture_url"), false);
  assert.equal(capturedParams.some((value) => String(value).includes("should-not-be-saved")), false);
  assert.equal(capturedParams.length, 11);
});

test("Google 로그인과 신규 계정 생성은 외부 이미지 URL을 DB에 저장하지 않는다", async () => {
  let updateStatement = "";
  let updateParams = [];
  const googleSql = {
    async query(statement, params = []) {
      const normalized = normalizeSql(statement);

      if (normalized.includes("where google_sub = $1")) {
        return [{ id: USER.id, email: USER.email, google_sub: "google-user-73" }];
      }

      updateStatement = normalized;
      updateParams = [...params];
      return [];
    },
  };

  await actualAuth.findOrCreateUser(googleSql, {
    email: USER.email,
    googleSub: "google-user-73",
    name: "회원",
    pictureUrl: "https://google.example/profile.png",
  });

  assert.equal(updateStatement.includes("picture_url"), false);
  assert.equal(updateParams.some((value) => String(value).includes("google.example")), false);

  let insertStatement = "";
  let insertParams = [];
  const newGoogleSql = {
    async query(statement, params = []) {
      const normalized = normalizeSql(statement);

      if (normalized.startsWith("select")) {
        return [];
      }

      insertStatement = normalized;
      insertParams = [...params];
      return [{ id: 74, email: "new-google@example.com" }];
    },
  };

  await actualAuth.findOrCreateUser(newGoogleSql, {
    email: "new-google@example.com",
    googleSub: "google-user-74",
    name: "신규 회원",
    pictureUrl: "https://google.example/new-profile.png",
  });

  assert.equal(insertStatement.includes("picture_url"), false);
  assert.equal(insertParams.some((value) => String(value).includes("google.example")), false);
});

async function requestMember(route, method, body) {
  const request = {
    body,
    headers: {},
    method,
    query: {
      path: ["member", ...route.split("/")],
    },
    url: `/api/member/${route}`,
  };
  const response = createResponse();

  await handleMember(request, response);
  return response.result;
}

async function requestGroups(route, method, body) {
  const request = {
    body,
    headers: {},
    method,
    query: {
      path: ["groups", ...route.split("/")],
    },
    url: `/api/groups/${route}`,
  };
  const response = createResponse();

  await handleGroups(request, response);
  return response.result;
}

function createResponse() {
  const headers = new Map();
  const response = {
    result: null,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    status(statusCode) {
      response.statusCode = statusCode;
      return response;
    },
    json(body) {
      response.result = {
        body,
        headers,
        statusCode: response.statusCode,
      };
    },
  };

  return response;
}

function profileRow() {
  return {
    email: state.profile.email,
    name: state.profile.name,
    pending_picture_key: state.current.pendingPictureKey,
    picture_key: state.current.pictureKey,
    picture_url: state.current.pictureUrl,
    region: state.profile.region,
    position: state.profile.position,
    genre: state.profile.genre,
    memo: state.profile.memo,
  };
}

function normalizeSql(statement) {
  return String(statement).replace(/\s+/g, " ").trim().toLowerCase();
}

function extensionForContentType(contentType) {
  return ({
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
  })[contentType] || ".bin";
}

function installFakeModule(modulePath, exports) {
  const fakeModule = new Module(modulePath);

  fakeModule.filename = modulePath;
  fakeModule.loaded = true;
  fakeModule.exports = exports;
  require.cache[modulePath] = fakeModule;
}

async function withoutConsoleError(callback) {
  const originalConsoleError = console.error;

  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.error = originalConsoleError;
  }
}
