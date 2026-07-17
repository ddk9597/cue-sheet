const crypto = require("node:crypto");
const {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const PRESIGNED_UPLOAD_EXPIRES_SECONDS = 300;
const IMAGE_EXTENSION_BY_CONTENT_TYPE = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);
const IMAGE_CONTENT_TYPE_BY_EXTENSION = new Map(
  [...IMAGE_EXTENSION_BY_CONTENT_TYPE].map(([contentType, extension]) => [extension, contentType]),
);
const PROFILE_UPLOAD_PURPOSE = "profile";
const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
let cachedStorage = null;

function getR2Storage() {
  if (cachedStorage) {
    return cachedStorage;
  }

  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(process.env.R2_BUCKET_NAME || "").trim();
  const publicBaseUrl = normalizePublicBaseUrl(process.env.R2_PUBLIC_BASE_URL);

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throwR2Error(
      503,
      "r2_storage_not_configured",
      "R2 이미지 저장소 환경변수를 확인해 주세요.",
    );
  }

  cachedStorage = {
    bucket,
    publicBaseUrl,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };

  return cachedStorage;
}

function getR2PublicBaseUrl() {
  const publicBaseUrl = normalizePublicBaseUrl(process.env.R2_PUBLIC_BASE_URL);

  if (!publicBaseUrl) {
    throwR2Error(
      503,
      "r2_public_url_not_configured",
      "R2 이미지 공개 주소 환경변수를 확인해 주세요.",
    );
  }

  return publicBaseUrl;
}

function normalizePublicBaseUrl(value) {
  try {
    const url = new URL(String(value || "").trim());

    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      return "";
    }

    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function validateImageUploadRequest(payload = {}) {
  const contentType = typeof payload.contentType === "string" ? payload.contentType : "";
  const size = payload.size;
  const purpose = typeof payload.purpose === "string" ? payload.purpose : "";

  if (!IMAGE_EXTENSION_BY_CONTENT_TYPE.has(contentType)) {
    throwR2Error(
      400,
      "unsupported_image_type",
      "JPG, PNG, WebP 또는 AVIF 이미지만 업로드할 수 있습니다.",
    );
  }

  if (!Number.isInteger(size) || size <= 0) {
    throwR2Error(400, "invalid_image_size", "이미지 파일 크기를 확인해 주세요.");
  }

  if (size > MAX_IMAGE_SIZE_BYTES) {
    throwR2Error(413, "image_too_large", "이미지는 5MB 이하만 업로드할 수 있습니다.");
  }

  if (purpose !== PROFILE_UPLOAD_PURPOSE) {
    throwR2Error(400, "invalid_upload_purpose", "지원하지 않는 이미지 업로드 목적입니다.");
  }

  return {
    contentType,
    purpose,
    size,
  };
}

function createImageObjectKey(userId, contentType, options = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const extension = IMAGE_EXTENSION_BY_CONTENT_TYPE.get(contentType);

  if (!normalizedUserId || !extension) {
    throwR2Error(400, "invalid_image_upload", "이미지 업로드 정보를 확인해 주세요.");
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const randomUUID = typeof options.randomUUID === "function"
    ? options.randomUUID
    : crypto.randomUUID;
  const uuid = String(randomUUID()).toLowerCase();

  if (!new RegExp(`^${UUID_PATTERN}$`).test(uuid)) {
    throwR2Error(500, "image_key_generation_failed", "이미지 저장 경로를 만들지 못했습니다.");
  }

  return `users/${normalizedUserId}/images/${year}/${month}/${uuid}.${extension}`;
}

function isOwnedImageObjectKey(objectKey, userId) {
  const normalizedUserId = normalizeUserId(userId);

  if (!normalizedUserId || typeof objectKey !== "string") {
    return false;
  }

  const pattern = new RegExp(
    `^users/${normalizedUserId}/images/\\d{4}/(?:0[1-9]|1[0-2])/${UUID_PATTERN}\\.(?:jpg|png|webp|avif)$`,
  );

  return pattern.test(objectKey);
}

function getExpectedImageContentType(objectKey) {
  const match = /\.([a-z0-9]+)$/.exec(String(objectKey || ""));

  return match ? IMAGE_CONTENT_TYPE_BY_EXTENSION.get(match[1]) || "" : "";
}

function validateUploadedImageHead(head, objectKey) {
  const contentLength = Number(head?.ContentLength);
  const contentType = String(head?.ContentType || "");
  const expectedContentType = getExpectedImageContentType(objectKey);

  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throwR2Error(422, "invalid_uploaded_image_size", "업로드된 이미지 크기를 확인할 수 없습니다.");
  }

  if (contentLength > MAX_IMAGE_SIZE_BYTES) {
    throwR2Error(422, "uploaded_image_too_large", "업로드된 이미지가 5MB를 초과합니다.");
  }

  if (!IMAGE_EXTENSION_BY_CONTENT_TYPE.has(contentType)) {
    throwR2Error(
      422,
      "unsupported_uploaded_image_type",
      "업로드된 객체가 지원하는 이미지 형식이 아닙니다.",
    );
  }

  if (!expectedContentType || expectedContentType !== contentType) {
    throwR2Error(
      422,
      "uploaded_image_type_mismatch",
      "업로드된 이미지 형식이 저장 경로와 일치하지 않습니다.",
    );
  }

  return {
    contentLength,
    contentType,
  };
}

async function createPresignedImageUpload({ userId, contentType, size }, dependencies = {}) {
  const storage = dependencies.storage || getR2Storage();
  const contentLength = Number(size);

  if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > MAX_IMAGE_SIZE_BYTES) {
    throwR2Error(400, "invalid_image_size", "이미지 파일 크기를 확인해 주세요.");
  }

  const objectKey = createImageObjectKey(userId, contentType, dependencies);
  const command = new PutObjectCommand({
    Bucket: storage.bucket,
    Key: objectKey,
    ContentLength: contentLength,
    ContentType: contentType,
  });
  const signUrl = dependencies.getSignedUrl || getSignedUrl;
  const uploadUrl = await signUrl(storage.client, command, {
    expiresIn: PRESIGNED_UPLOAD_EXPIRES_SECONDS,
    signableHeaders: new Set(["content-length", "content-type"]),
  });

  return {
    uploadUrl,
    objectKey,
  };
}

async function headImageObject(objectKey, dependencies = {}) {
  const storage = dependencies.storage || getR2Storage();

  return storage.client.send(new HeadObjectCommand({
    Bucket: storage.bucket,
    Key: objectKey,
  }));
}

async function deleteImageObject(objectKey, dependencies = {}) {
  const storage = dependencies.storage || getR2Storage();

  await storage.client.send(new DeleteObjectCommand({
    Bucket: storage.bucket,
    Key: objectKey,
  }));
}

function buildImageDisplayUrl(objectKey, publicBaseUrl = getR2PublicBaseUrl()) {
  const normalizedObjectKey = String(objectKey || "");

  if (!normalizedObjectKey || normalizedObjectKey.startsWith("/") || normalizedObjectKey.includes("..")) {
    return "";
  }

  return `${publicBaseUrl}/${normalizedObjectKey}`;
}

function resolveProfilePictureUrl(row) {
  const objectKey = String(row?.picture_key || "").trim();

  if (objectKey) {
    return buildImageDisplayUrl(objectKey);
  }

  return String(row?.picture_url || "").trim();
}

function getOwnedLegacyProfileImageKey(value, userId, publicBaseUrl = getR2PublicBaseUrl()) {
  const normalizedUserId = normalizeUserId(userId);

  if (!normalizedUserId) {
    return "";
  }

  try {
    const url = new URL(String(value || ""));
    const base = new URL(`${publicBaseUrl}/`);
    const basePath = base.pathname.replace(/\/$/, "");

    if (url.origin !== base.origin || !url.pathname.startsWith(`${basePath}/`)) {
      return "";
    }

    const objectKey = decodeURIComponent(url.pathname.slice(basePath.length + 1));
    const legacyPattern = new RegExp(`^profiles/${normalizedUserId}/${UUID_PATTERN}\\.webp$`);

    return legacyPattern.test(objectKey) || isOwnedImageObjectKey(objectKey, normalizedUserId)
      ? objectKey
      : "";
  } catch {
    return "";
  }
}

function isStorageObjectNotFound(error) {
  const code = String(error?.name || error?.Code || error?.code || "");
  const statusCode = Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0);

  return statusCode === 404 || ["NoSuchKey", "NotFound", "NoSuchObject"].includes(code);
}

function getSafeStorageErrorDetails(error) {
  return {
    name: String(error?.name || "StorageError").slice(0, 80),
    code: String(error?.Code || error?.code || "").slice(0, 80),
    statusCode: Number(error?.$metadata?.httpStatusCode || error?.statusCode || 0) || undefined,
  };
}

function normalizeUserId(value) {
  const userId = String(value || "").trim();

  return /^\d+$/.test(userId) ? userId : "";
}

function throwR2Error(statusCode, errorCode, message) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;
  throw error;
}

function resetR2StorageCacheForTests() {
  cachedStorage = null;
}

module.exports = {
  MAX_IMAGE_SIZE_BYTES,
  PRESIGNED_UPLOAD_EXPIRES_SECONDS,
  buildImageDisplayUrl,
  createImageObjectKey,
  createPresignedImageUpload,
  deleteImageObject,
  getExpectedImageContentType,
  getOwnedLegacyProfileImageKey,
  getR2PublicBaseUrl,
  getR2Storage,
  getSafeStorageErrorDetails,
  headImageObject,
  isOwnedImageObjectKey,
  isStorageObjectNotFound,
  normalizePublicBaseUrl,
  resetR2StorageCacheForTests,
  resolveProfilePictureUrl,
  validateImageUploadRequest,
  validateUploadedImageHead,
};
