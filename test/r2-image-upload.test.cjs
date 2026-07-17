const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const SOURCE_PATH = path.join(__dirname, "..", "r2-image-upload.js");
const SOURCE = fs.readFileSync(SOURCE_PATH, "utf8");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const OBJECT_KEY = "users/73/images/2026/07/123e4567-e89b-42d3-a456-426614174000.webp";
const UPLOAD_URL = "https://test-bucket.example.test/presigned-upload?signature=temporary";

function loadUploader(fetchImpl) {
  const window = {};
  const context = vm.createContext({
    URL,
    fetch: fetchImpl,
    window,
  });

  vm.runInContext(SOURCE, context, { filename: SOURCE_PATH });

  return window.R2ImageUpload;
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}

function imageFile(overrides = {}) {
  return {
    name: "profile.webp",
    size: 256,
    type: "image/webp",
    ...overrides,
  };
}

function parseRequestBody(call) {
  return JSON.parse(call.options.body);
}

async function assertUploadError(promise, expectedCode, expectedMessagePattern) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.name, "ImageUploadError");
    assert.equal(error.code, expectedCode);

    if (expectedMessagePattern) {
      assert.match(error.message, expectedMessagePattern);
    }

    return true;
  });
}

test("presign -> exact PUT -> complete 순서로 직접 업로드하고 필요한 값만 반환한다", async () => {
  const calls = [];
  const progress = [];
  const file = imageFile();
  const profile = { id: 73, pictureKey: OBJECT_KEY };
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });

    if (calls.length === 1) {
      return jsonResponse(200, {
        uploadUrl: UPLOAD_URL,
        objectKey: OBJECT_KEY,
        expiresIn: 300,
        ignoredSecret: "must-not-propagate",
      });
    }

    if (calls.length === 2) {
      return { ok: true, status: 200 };
    }

    return jsonResponse(200, {
      objectKey: OBJECT_KEY,
      displayUrl: `https://images.example.test/${OBJECT_KEY}`,
      profile,
      uploadUrl: "https://must-not-be-returned.example.test/",
    });
  };
  const uploader = loadUploader(fetchImpl);

  const result = await uploader.uploadImageToR2(file, "profile", {
    onProgress(update) {
      progress.push({ stage: update.stage, message: update.message });
    },
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "/api/member/uploads/presign");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.deepEqual(parseRequestBody(calls[0]), {
    fileName: "profile.webp",
    contentType: "image/webp",
    size: 256,
    purpose: "profile",
  });

  assert.equal(calls[1].url, UPLOAD_URL);
  assert.equal(calls[1].options.method, "PUT");
  assert.deepEqual(Object.keys(calls[1].options.headers), ["Content-Type"]);
  assert.equal(calls[1].options.headers["Content-Type"], "image/webp");
  assert.strictEqual(calls[1].options.body, file);
  assert.equal("credentials" in calls[1].options, false);

  assert.equal(calls[2].url, "/api/member/uploads/complete");
  assert.equal(calls[2].options.method, "POST");
  assert.equal(calls[2].options.credentials, "same-origin");
  assert.deepEqual(parseRequestBody(calls[2]), {
    objectKey: OBJECT_KEY,
    purpose: "profile",
  });
  assert.deepEqual(Array.from(Object.keys(result)), ["objectKey", "displayUrl", "profile"]);
  assert.equal(result.objectKey, OBJECT_KEY);
  assert.equal(result.displayUrl, `https://images.example.test/${OBJECT_KEY}`);
  assert.strictEqual(result.profile, profile);
  assert.deepEqual(progress.map(({ stage }) => stage), ["presign", "upload", "complete", "done"]);
});

test("JPEG, PNG, WebP, AVIF는 요청한 MIME을 presign과 PUT에 그대로 사용한다", async (t) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];

  for (const contentType of allowedTypes) {
    await t.test(contentType, async () => {
      const calls = [];
      const fetchImpl = async (url, options) => {
        calls.push({ url: String(url), options });

        if (calls.length === 1) {
          return jsonResponse(200, { uploadUrl: UPLOAD_URL, objectKey: OBJECT_KEY });
        }

        if (calls.length === 2) {
          return { ok: true, status: 200 };
        }

        return jsonResponse(200, { objectKey: OBJECT_KEY });
      };
      const uploader = loadUploader(fetchImpl);
      const file = imageFile({ name: `profile-${contentType.split("/")[1]}`, type: contentType });

      await uploader.uploadImageToR2(file, "profile");

      assert.equal(parseRequestBody(calls[0]).contentType, contentType);
      assert.equal(calls[1].options.headers["Content-Type"], contentType);
      assert.strictEqual(calls[1].options.body, file);
    });
  }
});

test("지원하지 않는 MIME, 잘못된 크기, 5MB 초과 파일은 네트워크 요청 전에 거부한다", async () => {
  let fetchCount = 0;
  const uploader = loadUploader(async () => {
    fetchCount += 1;
    throw new Error("local validation failures must not fetch");
  });
  const invalidCases = [
    [imageFile({ type: "image/gif" }), "unsupported_image_type"],
    [imageFile({ size: 0 }), "invalid_image_size"],
    [imageFile({ size: -1 }), "invalid_image_size"],
    [imageFile({ size: 1.5 }), "invalid_image_size"],
    [imageFile({ size: Number.NaN }), "invalid_image_size"],
    [imageFile({ size: Number.POSITIVE_INFINITY }), "invalid_image_size"],
    [imageFile({ size: MAX_IMAGE_BYTES + 1 }), "image_too_large"],
  ];

  for (const [file, errorCode] of invalidCases) {
    await assertUploadError(uploader.uploadImageToR2(file, "profile"), errorCode);
  }

  await assertUploadError(
    uploader.uploadImageToR2(imageFile(), "album"),
    "invalid_upload_purpose",
  );
  assert.equal(fetchCount, 0);
});

test("presign 인증 실패는 로그인 필요 오류로 변환하고 PUT을 시작하지 않는다", async () => {
  const calls = [];
  const uploader = loadUploader(async (url, options) => {
    calls.push({ url: String(url), options });
    return jsonResponse(401, { error: "not_authenticated" });
  });

  await assertUploadError(
    uploader.uploadImageToR2(imageFile(), "profile"),
    "login_required",
    /로그인/,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/member/uploads/presign");
});

test("R2 PUT 네트워크 실패는 CORS 안내를 포함하고 complete를 호출하지 않는다", async () => {
  const calls = [];
  const networkError = new TypeError("Failed to fetch");
  const uploader = loadUploader(async (url, options) => {
    calls.push({ url: String(url), options });

    if (calls.length === 1) {
      return jsonResponse(200, { uploadUrl: UPLOAD_URL, objectKey: OBJECT_KEY });
    }

    throw networkError;
  });

  await assert.rejects(uploader.uploadImageToR2(imageFile(), "profile"), (error) => {
    assert.equal(error.code, "r2_cors_or_network_error");
    assert.match(error.message, /CORS/);
    assert.strictEqual(error.cause, networkError);
    return true;
  });
  assert.equal(calls.length, 2);
});

test("R2 PUT 비정상 응답은 업로드 실패로 처리하고 complete를 호출하지 않는다", async () => {
  const calls = [];
  const uploader = loadUploader(async (url, options) => {
    calls.push({ url: String(url), options });

    return calls.length === 1
      ? jsonResponse(200, { uploadUrl: UPLOAD_URL, objectKey: OBJECT_KEY })
      : { ok: false, status: 403 };
  });

  await assertUploadError(
    uploader.uploadImageToR2(imageFile(), "profile"),
    "r2_upload_failed",
    /R2 이미지 업로드/,
  );
  assert.equal(calls.length, 2);
});

test("complete의 객체 검증 오류를 서버 코드와 메시지 그대로 전달한다", async () => {
  const calls = [];
  const uploader = loadUploader(async (url, options) => {
    calls.push({ url: String(url), options });

    if (calls.length === 1) {
      return jsonResponse(200, { uploadUrl: UPLOAD_URL, objectKey: OBJECT_KEY });
    }

    if (calls.length === 2) {
      return { ok: true, status: 200 };
    }

    return jsonResponse(422, {
      error: "uploaded_image_type_mismatch",
      message: "업로드된 이미지 형식이 요청과 일치하지 않습니다.",
    });
  });

  await assertUploadError(
    uploader.uploadImageToR2(imageFile(), "profile"),
    "uploaded_image_type_mismatch",
    /형식이 요청과 일치하지 않습니다/,
  );
  assert.equal(calls.length, 3);
});

test("complete의 DB 저장 실패를 별도 오류로 안내한다", async () => {
  const calls = [];
  const uploader = loadUploader(async (url, options) => {
    calls.push({ url: String(url), options });

    if (calls.length === 1) {
      return jsonResponse(200, { uploadUrl: UPLOAD_URL, objectKey: OBJECT_KEY });
    }

    if (calls.length === 2) {
      return { ok: true, status: 200 };
    }

    return jsonResponse(500, { error: "profile_image_db_save_failed" });
  });

  await assertUploadError(
    uploader.uploadImageToR2(imageFile(), "profile"),
    "profile_image_db_save_failed",
    /DB에 저장하지 못했습니다/,
  );
  assert.equal(calls.length, 3);
});

test("presign 또는 complete 응답이 objectKey 계약을 어기면 성공으로 처리하지 않는다", async (t) => {
  await t.test("presign에 HTTPS uploadUrl이 없으면 PUT하지 않는다", async () => {
    let fetchCount = 0;
    const uploader = loadUploader(async () => {
      fetchCount += 1;
      return jsonResponse(200, {
        uploadUrl: "http://insecure.example.test/upload",
        objectKey: OBJECT_KEY,
      });
    });

    await assertUploadError(
      uploader.uploadImageToR2(imageFile(), "profile"),
      "invalid_presign_response",
    );
    assert.equal(fetchCount, 1);
  });

  await t.test("complete가 다른 objectKey를 반환하면 실패한다", async () => {
    let fetchCount = 0;
    const uploader = loadUploader(async () => {
      fetchCount += 1;

      if (fetchCount === 1) {
        return jsonResponse(200, { uploadUrl: UPLOAD_URL, objectKey: OBJECT_KEY });
      }

      if (fetchCount === 2) {
        return { ok: true, status: 200 };
      }

      return jsonResponse(200, {
        objectKey: "users/999/images/2026/07/other.webp",
      });
    });

    await assertUploadError(
      uploader.uploadImageToR2(imageFile(), "profile"),
      "invalid_complete_response",
    );
    assert.equal(fetchCount, 3);
  });
});
