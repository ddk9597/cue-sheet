(() => {
  const PRESIGN_ENDPOINT = "/api/member/uploads/presign";
  const COMPLETE_ENDPOINT = "/api/member/uploads/complete";
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
  ]);

  class ImageUploadError extends Error {
    constructor(code, message, cause) {
      super(message);
      this.name = "ImageUploadError";
      this.code = code;

      if (cause) {
        this.cause = cause;
      }
    }
  }

  async function uploadImageToR2(file, purpose, options = {}) {
    const contentType = String(file?.type || "").trim().toLowerCase();
    const size = Number(file?.size);
    const fileName = String(file?.name || "image").trim().slice(0, 255) || "image";

    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new ImageUploadError(
        "unsupported_image_type",
        "JPG, PNG, WebP 또는 AVIF 이미지를 선택해 주세요.",
      );
    }

    if (!Number.isInteger(size) || size <= 0) {
      throw new ImageUploadError("invalid_image_size", "비어 있지 않은 이미지 파일을 선택해 주세요.");
    }

    if (size > MAX_IMAGE_BYTES) {
      throw new ImageUploadError("image_too_large", "5MB 이하의 이미지를 선택해 주세요.");
    }

    if (purpose !== "profile") {
      throw new ImageUploadError("invalid_upload_purpose", "지원하지 않는 이미지 업로드 목적입니다.");
    }

    notifyProgress(options, "presign", "안전한 업로드 주소를 준비하는 중입니다.");
    const presign = await requestJson(PRESIGN_ENDPOINT, {
      fileName,
      contentType,
      size,
      purpose,
    }, "presign");
    const uploadUrl = normalizeUploadUrl(presign.uploadUrl);
    const objectKey = String(presign.objectKey || "").trim();

    if (!uploadUrl || !objectKey) {
      throw new ImageUploadError(
        "invalid_presign_response",
        "Presigned URL 발급 응답을 확인하지 못했습니다.",
      );
    }

    notifyProgress(options, "upload", "이미지를 Cloudflare R2로 직접 업로드하는 중입니다.");

    let uploadResponse;

    try {
      uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      });
    } catch (error) {
      throw new ImageUploadError(
        "r2_cors_or_network_error",
        "R2에 연결하지 못했습니다. 버킷 CORS의 Origin, PUT, Content-Type 설정을 확인해 주세요.",
        error,
      );
    }

    if (!uploadResponse.ok) {
      throw new ImageUploadError(
        "r2_upload_failed",
        "Cloudflare R2 이미지 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }

    notifyProgress(options, "complete", "업로드된 이미지와 저장 정보를 확인하는 중입니다.");
    const completed = await requestJson(COMPLETE_ENDPOINT, {
      objectKey,
      purpose,
    }, "complete");

    if (String(completed.objectKey || "") !== objectKey) {
      throw new ImageUploadError(
        "invalid_complete_response",
        "업로드 완료 검증 응답이 요청한 이미지와 일치하지 않습니다.",
      );
    }

    notifyProgress(options, "done", "프로필 사진을 저장했습니다.");
    return {
      objectKey,
      displayUrl: String(completed.displayUrl || "").trim(),
      profile: completed.profile || null,
    };
  }

  async function requestJson(url, body, stage) {
    let response;

    try {
      response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const isComplete = stage === "complete";

      throw new ImageUploadError(
        isComplete ? "complete_request_failed" : "presign_request_failed",
        isComplete
          ? "업로드 완료 검증 API에 연결하지 못했습니다."
          : "Presigned URL 발급 API에 연결하지 못했습니다.",
        error,
      );
    }

    const payload = await safeReadJson(response);

    if (response.ok) {
      return payload;
    }

    if (response.status === 401 || payload.error === "not_authenticated") {
      throw new ImageUploadError("login_required", "로그인 후 이미지를 업로드할 수 있습니다.");
    }

    if (stage === "presign") {
      throw new ImageUploadError(
        payload.error || "presign_failed",
        payload.message || "Presigned URL을 발급하지 못했습니다.",
      );
    }

    const databaseFailed = payload.error === "profile_image_db_failed"
      || payload.error === "profile_image_db_save_failed"
      || payload.error === "database_not_configured";

    throw new ImageUploadError(
      payload.error || (databaseFailed ? "profile_image_db_failed" : "upload_verification_failed"),
      payload.message || (databaseFailed
        ? "업로드한 이미지 정보를 DB에 저장하지 못했습니다."
        : "업로드 완료 검증에 실패했습니다."),
    );
  }

  async function safeReadJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function normalizeUploadUrl(value) {
    try {
      const url = new URL(String(value || ""));

      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  }

  function notifyProgress(options, stage, message) {
    if (typeof options?.onProgress !== "function") {
      return;
    }

    try {
      options.onProgress({ stage, message });
    } catch {
      // Progress reporting must not interrupt the upload.
    }
  }

  window.uploadImageToR2 = uploadImageToR2;
  window.R2ImageUpload = {
    ALLOWED_IMAGE_TYPES,
    ImageUploadError,
    MAX_IMAGE_BYTES,
    uploadImageToR2,
  };
})();
