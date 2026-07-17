const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const R2_ENV_NAMES = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
];
const originalEnvironment = new Map();

for (const name of R2_ENV_NAMES) {
  originalEnvironment.set(name, process.env[name]);
}

const r2 = require("../api/_lib/r2");
const USER_ID = "73";
const UUID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = new Date("2026-07-17T10:30:00.000Z");

before(() => {
  process.env.R2_PUBLIC_BASE_URL = "https://images.example.test/assets";
});

after(() => {
  for (const [name, value] of originalEnvironment) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  r2.resetR2StorageCacheForTests();
});

test("업로드 요청은 네 이미지 MIME과 5MB 경계만 허용한다", () => {
  for (const contentType of ["image/jpeg", "image/png", "image/webp", "image/avif"]) {
    assert.deepEqual(
      r2.validateImageUploadRequest({
        fileName: "ignored-name",
        contentType,
        size: r2.MAX_IMAGE_SIZE_BYTES,
        purpose: "profile",
      }),
      {
        contentType,
        purpose: "profile",
        size: r2.MAX_IMAGE_SIZE_BYTES,
      },
    );
  }

  for (const size of [undefined, null, "1", 0, -1, 1.5]) {
    assert.throws(
      () => r2.validateImageUploadRequest({ contentType: "image/png", size, purpose: "profile" }),
      (error) => error.errorCode === "invalid_image_size" && error.statusCode === 400,
    );
  }

  assert.throws(
    () => r2.validateImageUploadRequest({
      contentType: "image/png",
      size: r2.MAX_IMAGE_SIZE_BYTES + 1,
      purpose: "profile",
    }),
    (error) => error.errorCode === "image_too_large" && error.statusCode === 413,
  );
  assert.throws(
    () => r2.validateImageUploadRequest({ contentType: "image/gif", size: 1, purpose: "profile" }),
    (error) => error.errorCode === "unsupported_image_type",
  );
  assert.throws(
    () => r2.validateImageUploadRequest({ contentType: "image/png", size: 1, purpose: "album" }),
    (error) => error.errorCode === "invalid_upload_purpose",
  );
});

test("objectKey는 사용자 입력 파일명을 쓰지 않고 MIME에서 확장자를 정한다", () => {
  const cases = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/avif", "avif"],
  ]);

  for (const [contentType, extension] of cases) {
    const objectKey = r2.createImageObjectKey(USER_ID, contentType, {
      now: NOW,
      randomUUID: () => UUID,
      fileName: "../../other-user/secret.exe",
    });

    assert.equal(
      objectKey,
      `users/${USER_ID}/images/2026/07/${UUID}.${extension}`,
    );
    assert.equal(objectKey.includes("secret"), false);
    assert.equal(r2.isOwnedImageObjectKey(objectKey, USER_ID), true);
  }
});

test("소유권 검사는 타 사용자, 조작 경로, 인코딩 우회를 거부한다", () => {
  const owned = `users/${USER_ID}/images/2026/07/${UUID}.webp`;

  assert.equal(r2.isOwnedImageObjectKey(owned, USER_ID), true);
  assert.equal(r2.isOwnedImageObjectKey(owned, "7"), false);
  assert.equal(r2.isOwnedImageObjectKey(`users/${USER_ID}/images/2026/13/${UUID}.webp`, USER_ID), false);
  assert.equal(r2.isOwnedImageObjectKey(`users/${USER_ID}/images/2026/07/../${UUID}.webp`, USER_ID), false);
  assert.equal(r2.isOwnedImageObjectKey(`users/${USER_ID}%2Fimages/2026/07/${UUID}.webp`, USER_ID), false);
  assert.equal(r2.isOwnedImageObjectKey(`users/${USER_ID}/images/2026/07/${UUID}.gif`, USER_ID), false);
});

test("Presigned PUT은 Bucket, Key, ContentType, ContentLength를 넣고 300초로 서명한다", async () => {
  const calls = [];
  const storage = {
    bucket: "test-bucket",
    client: { name: "fake-client" },
  };
  const result = await r2.createPresignedImageUpload(
    { userId: USER_ID, contentType: "image/png", size: 1234 },
    {
      storage,
      now: NOW,
      randomUUID: () => UUID,
      getSignedUrl: async (client, command, options) => {
        calls.push({ client, command, options });
        return "https://upload.example.test/temporary-signature";
      },
    },
  );

  assert.deepEqual(result, {
    uploadUrl: "https://upload.example.test/temporary-signature",
    objectKey: `users/${USER_ID}/images/2026/07/${UUID}.png`,
  });
  assert.equal(calls.length, 1);
  assert.strictEqual(calls[0].client, storage.client);
  assert.ok(calls[0].command instanceof PutObjectCommand);
  assert.deepEqual(calls[0].command.input, {
    Bucket: "test-bucket",
    Key: result.objectKey,
    ContentLength: 1234,
    ContentType: "image/png",
  });
  assert.equal(calls[0].options.expiresIn, 300);
  assert.deepEqual([...calls[0].options.signableHeaders], ["content-length", "content-type"]);
  assert.equal("Body" in calls[0].command.input, false);
});

test("Presigned PUT은 비정상 또는 5MB 초과 ContentLength를 서명하지 않는다", async () => {
  const storage = {
    bucket: "test-bucket",
    client: { name: "fake-client" },
  };

  for (const size of [0, -1, 1.5, r2.MAX_IMAGE_SIZE_BYTES + 1]) {
    await assert.rejects(
      () => r2.createPresignedImageUpload(
        { userId: USER_ID, contentType: "image/png", size },
        { storage, now: NOW, randomUUID: () => UUID },
      ),
      (error) => error.errorCode === "invalid_image_size",
    );
  }
});

test("R2 S3Client는 auto region과 계정 endpoint로 한 번만 생성해 재사용한다", async () => {
  process.env.R2_ACCOUNT_ID = "testaccount";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_PUBLIC_BASE_URL = "https://images.example.test/assets";
  r2.resetR2StorageCacheForTests();

  const first = r2.getR2Storage();
  const second = r2.getR2Storage();
  const endpoint = await first.client.config.endpoint();

  assert.strictEqual(second, first);
  assert.strictEqual(second.client, first.client);
  assert.equal(await first.client.config.region(), "auto");
  assert.equal(endpoint.protocol, "https:");
  assert.equal(endpoint.hostname, "testaccount.r2.cloudflarestorage.com");
  assert.equal(first.bucket, "test-bucket");
  assert.deepEqual(Object.keys(first).sort(), ["bucket", "client", "publicBaseUrl"]);
});

test("실제 Presigned URL의 SignedHeaders에 content-type과 content-length가 포함된다", async () => {
  process.env.R2_ACCOUNT_ID = "testaccount";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_BUCKET_NAME = "test-bucket";
  process.env.R2_PUBLIC_BASE_URL = "https://images.example.test/assets";
  r2.resetR2StorageCacheForTests();

  const { uploadUrl } = await r2.createPresignedImageUpload(
    { userId: USER_ID, contentType: "image/png", size: 2048 },
    { now: NOW, randomUUID: () => UUID },
  );
  const signedUrl = new URL(uploadUrl);
  const signedHeaders = String(signedUrl.searchParams.get("X-Amz-SignedHeaders") || "").split(";");

  assert.ok(signedHeaders.includes("content-type"));
  assert.ok(signedHeaders.includes("content-length"));
  assert.equal(signedUrl.searchParams.get("X-Amz-Expires"), "300");
});

test("Head와 Delete는 같은 bucket과 objectKey만 SDK 명령에 전달한다", async () => {
  const commands = [];
  const storage = {
    bucket: "test-bucket",
    client: {
      async send(command) {
        commands.push(command);
        return command instanceof HeadObjectCommand
          ? { ContentLength: 42, ContentType: "image/webp" }
          : undefined;
      },
    },
  };
  const objectKey = `users/${USER_ID}/images/2026/07/${UUID}.webp`;

  const head = await r2.headImageObject(objectKey, { storage });
  await r2.deleteImageObject(objectKey, { storage });

  assert.deepEqual(head, { ContentLength: 42, ContentType: "image/webp" });
  assert.ok(commands[0] instanceof HeadObjectCommand);
  assert.deepEqual(commands[0].input, { Bucket: "test-bucket", Key: objectKey });
  assert.ok(commands[1] instanceof DeleteObjectCommand);
  assert.deepEqual(commands[1].input, { Bucket: "test-bucket", Key: objectKey });
});

test("Head 검증은 실제 크기, MIME과 objectKey 확장자가 모두 맞아야 통과한다", () => {
  const objectKey = `users/${USER_ID}/images/2026/07/${UUID}.avif`;

  assert.deepEqual(
    r2.validateUploadedImageHead(
      { ContentLength: r2.MAX_IMAGE_SIZE_BYTES, ContentType: "image/avif" },
      objectKey,
    ),
    { contentLength: r2.MAX_IMAGE_SIZE_BYTES, contentType: "image/avif" },
  );

  assert.throws(
    () => r2.validateUploadedImageHead({ ContentLength: 0, ContentType: "image/avif" }, objectKey),
    (error) => error.errorCode === "invalid_uploaded_image_size",
  );
  assert.throws(
    () => r2.validateUploadedImageHead({
      ContentLength: r2.MAX_IMAGE_SIZE_BYTES + 1,
      ContentType: "image/avif",
    }, objectKey),
    (error) => error.errorCode === "uploaded_image_too_large",
  );
  assert.throws(
    () => r2.validateUploadedImageHead({ ContentLength: 1, ContentType: "image/gif" }, objectKey),
    (error) => error.errorCode === "unsupported_uploaded_image_type",
  );
  assert.throws(
    () => r2.validateUploadedImageHead({ ContentLength: 1, ContentType: "image/png" }, objectKey),
    (error) => error.errorCode === "uploaded_image_type_mismatch",
  );
});

test("표시 URL은 DB objectKey와 공개 base URL을 조합하고 legacy URL은 fallback한다", () => {
  const objectKey = `users/${USER_ID}/images/2026/07/${UUID}.jpg`;

  assert.equal(
    r2.buildImageDisplayUrl(objectKey, "https://images.example.test/assets"),
    `https://images.example.test/assets/${objectKey}`,
  );
  assert.equal(
    r2.resolveProfilePictureUrl({ picture_key: objectKey, picture_url: "https://legacy.example/pic.jpg" }),
    `https://images.example.test/assets/${objectKey}`,
  );
  assert.equal(
    r2.resolveProfilePictureUrl({ picture_key: "", picture_url: "https://legacy.example/pic.jpg" }),
    "https://legacy.example/pic.jpg",
  );
  assert.equal(
    r2.getOwnedLegacyProfileImageKey(
      `https://images.example.test/assets/profiles/${USER_ID}/${UUID}.webp`,
      USER_ID,
      "https://images.example.test/assets",
    ),
    `profiles/${USER_ID}/${UUID}.webp`,
  );
  assert.equal(
    r2.getOwnedLegacyProfileImageKey(
      `https://images.example.test/assets/profiles/999/${UUID}.webp`,
      USER_ID,
      "https://images.example.test/assets",
    ),
    "",
  );
});

test("R2 필수 환경변수가 빠지면 자격증명 값을 노출하지 않는 503 오류가 발생한다", () => {
  for (const name of R2_ENV_NAMES) {
    delete process.env[name];
  }
  r2.resetR2StorageCacheForTests();

  assert.throws(
    () => r2.getR2Storage(),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.errorCode, "r2_storage_not_configured");
      assert.equal(error.message.includes("secret"), false);
      return true;
    },
  );

  process.env.R2_PUBLIC_BASE_URL = "https://images.example.test/assets";
});
