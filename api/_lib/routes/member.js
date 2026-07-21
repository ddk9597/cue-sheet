const crypto = require("node:crypto");
const {
  getSessionUser,
  isValidEmail,
  normalizeEmail,
} = require("../auth");
const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const {
  buildImageDisplayUrl,
  createPresignedImageUpload,
  deleteImageObject,
  getOwnedLegacyProfileImageKey,
  getR2Storage,
  getSafeStorageErrorDetails,
  headImageObject,
  isOwnedImageObjectKey,
  isStorageObjectNotFound,
  normalizePublicBaseUrl,
  resolveProfilePictureUrl,
  validateImageUploadRequest,
  validateUploadedImageHead,
} = require("../r2");

const MAX_GROUP_NAME_LENGTH = 80;
const MAX_MEMO_LENGTH = 5000;
const ROUTE_METHODS = {
  bands: ["GET"],
  directory: ["GET"],
  me: ["GET"],
  dashboard: ["GET"],
  profile: ["GET", "PUT"],
  "profile-image": ["DELETE"],
  "uploads/presign": ["POST"],
  "uploads/complete": ["POST"],
  groups: ["GET", "POST"],
  invites: ["POST"],
  "invites/accept": ["POST"],
  "invites/reject": ["POST"],
  messages: ["GET"],
  "messages/unread-count": ["GET"],
  "messages/read": ["POST"],
  "messages/accept": ["POST"],
  memo: ["GET", "PUT"],
};

module.exports = async (request, response) => {
  const route = getMemberRoute(request);
  const allowedMethods = ROUTE_METHODS[route];

  if (!allowedMethods) {
    sendJson(response, 404, {
      error: "member_route_not_found",
      message: "회원 API 경로를 찾을 수 없습니다.",
    });
    return;
  }

  if (!allowedMethods.includes(request.method)) {
    methodNotAllowed(response, allowedMethods);
    return;
  }

  const sql = getSql();

  if (!sql) {
    sendJson(response, 503, {
      error: "database_not_configured",
      message: "DB 연결이 아직 설정되지 않았습니다.",
    });
    return;
  }

  try {
    await ensureSchema(sql);

    if (route === "bands") {
      await handleGetBands(sql, response);
      return;
    }

    if (route === "directory") {
      await handleGetDirectory(sql, response);
      return;
    }

    const sessionUser = await getSessionUser(sql, request);

    if (!sessionUser) {
      sendJson(response, 401, {
        error: "not_authenticated",
        message: "로그인 후 사용할 수 있습니다.",
      });
      return;
    }

    if (route === "groups" && request.method === "GET") {
      await handleGetGroups(sql, response, sessionUser);
      return;
    }

    if (route === "me") {
      await handleGetMe(sql, response, sessionUser);
      return;
    }

    if (route === "dashboard") {
      await handleGetDashboard(sql, response, sessionUser);
      return;
    }

    if (route === "profile" && request.method === "GET") {
      await handleGetProfile(sql, response, sessionUser);
      return;
    }

    if (route === "profile" && request.method === "PUT") {
      const payload = await readJsonBody(request);

      await handleSaveProfile(sql, response, sessionUser, payload);
      return;
    }

    if (route === "uploads/presign") {
      const payload = await readJsonBody(request);

      await handlePresignImageUpload(sql, response, sessionUser, payload);
      return;
    }

    if (route === "uploads/complete") {
      const payload = await readJsonBody(request);

      await handleCompleteImageUpload(sql, response, sessionUser, payload);
      return;
    }

    if (route === "profile-image") {

      await handleDeleteProfileImage(sql, response, sessionUser);
      return;
    }

    if (route === "groups" && request.method === "POST") {
      const payload = await readJsonBody(request);

      await handleCreateGroup(sql, response, sessionUser, payload);
      return;
    }

    if (route === "invites") {
      const payload = await readJsonBody(request);

      await handleCreateInvite(sql, response, sessionUser, payload);
      return;
    }

    if (route === "messages") {
      await handleGetMessages(sql, response, sessionUser);
      return;
    }

    if (route === "messages/unread-count") {
      await handleGetUnreadDirectMessageCount(sql, response, sessionUser);
      return;
    }

    if (route === "messages/read") {
      const payload = await readJsonBody(request);

      await handleReadMessage(sql, response, sessionUser, payload);
      return;
    }

    if (route === "messages/accept") {
      const payload = await readJsonBody(request);

      await handleAcceptMessage(sql, response, sessionUser, payload);
      return;
    }

    if (route === "invites/accept") {
      const payload = await readJsonBody(request);

      await handleAcceptMessage(sql, response, sessionUser, payload);
      return;
    }

    if (route === "invites/reject") {
      const payload = await readJsonBody(request);

      await handleRejectInvite(sql, response, sessionUser, payload);
      return;
    }

    if (route === "memo" && request.method === "GET") {
      await handleGetMemo(sql, response, sessionUser);
      return;
    }

    if (route === "memo" && request.method === "PUT") {
      const payload = await readJsonBody(request);

      await handleSaveMemo(sql, response, sessionUser, payload);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "invalid_json",
        message: "잘못된 요청 형식입니다.",
      });
      return;
    }

    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      console.error("member api error", error);
    }

    sendJson(response, statusCode, {
      error: error.errorCode || "member_api_failed",
      message: error.message || "회원 기능 요청을 처리하지 못했습니다.",
    });
  }
};

function getMemberRoute(request) {
  const queryPath = request.query?.path;

  if (Array.isArray(queryPath)) {
    return stripRoutePrefix(queryPath.join("/"), "member");
  }

  if (typeof queryPath === "string" && queryPath) {
    return stripRoutePrefix(queryPath, "member");
  }

  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);

  return url.pathname
    .replace(/^\/api\/member\/?/, "")
    .replace(/\/$/, "");
}

function stripRoutePrefix(route, prefix) {
  return String(route || "")
    .replace(new RegExp(`^${prefix}/?`), "")
    .replace(/\/$/, "");
}

async function handleGetGroups(sql, response, sessionUser) {
  const rows = await sql.query(
    [
      "SELECT g.id, g.name, gm.role, g.created_at, g.updated_at, COUNT(all_members.user_id)::int AS member_count",
      "FROM group_members gm",
      "JOIN groups g ON g.id = gm.group_id",
      "LEFT JOIN group_members all_members ON all_members.group_id = g.id",
      "WHERE gm.user_id = $1",
      "GROUP BY g.id, gm.role",
      "ORDER BY g.updated_at DESC, g.created_at DESC",
    ].join(" "),
    [sessionUser.id],
  );

  sendJson(response, 200, {
    groups: rows.map(normalizeGroupRow),
  });
}

async function handleGetDirectory(sql, response) {
  const rows = await sql.query(
    [
      "SELECT id, name, picture_url, picture_key, region, \"position\", genre, memo, last_login_at",
      "FROM app_users",
      "WHERE name <> '' OR region <> '' OR \"position\" <> '' OR genre <> '' OR picture_url <> '' OR picture_key <> ''",
      "ORDER BY last_login_at DESC, id DESC",
      "LIMIT 12",
    ].join(" "),
  );

  sendJson(response, 200, {
    members: rows.map(normalizeDirectoryRow),
  });
}

async function handleGetBands(sql, response) {
  const rows = await sql.query(
    [
      "SELECT",
      "g.id, g.name, g.description, g.created_at, g.updated_at,",
      "COUNT(gm.user_id)::int AS member_count,",
      "owner.name AS owner_name, owner.region AS owner_region, owner.genre AS owner_genre",
      "FROM groups g",
      "LEFT JOIN group_members gm ON gm.group_id = g.id",
      "LEFT JOIN app_users owner ON owner.id = g.owner_user_id",
      "GROUP BY g.id, owner.id",
      "ORDER BY g.updated_at DESC, g.created_at DESC",
      "LIMIT 12",
    ].join(" "),
  );

  sendJson(response, 200, {
    bands: rows.map(normalizeBandRow),
  });
}

async function handleGetMe(sql, response, sessionUser) {
  const rows = await sql.query(
    [
      "SELECT email, name, picture_url, picture_key, region, \"position\", genre, memo",
      "FROM app_users",
      "WHERE id = $1",
      "LIMIT 1",
    ].join(" "),
    [sessionUser.id],
  );

  sendJson(response, 200, {
    user: {
      id: String(sessionUser.id),
      email: normalizeEmail(sessionUser.email),
    },
    profile: normalizeProfileRow(rows[0], sessionUser),
  });
}

async function handleGetDashboard(sql, response, sessionUser) {
  const [
    cueRows,
    practiceRows,
    todoRows,
    groupRows,
    unreadInviteRows,
    unreadMessageRows,
    unreadDirectMessageRows,
  ] = await Promise.all([
    sql.query(
      [
        "SELECT COALESCE(jsonb_array_length(items), 0) AS cue_count",
        "FROM user_cue_sheet_state",
        "WHERE user_id = $1",
        "LIMIT 1",
      ].join(" "),
      [sessionUser.id],
    ),
    sql.query(
      [
        "SELECT logs",
        "FROM user_practice_calendar_state",
        "WHERE user_id = $1",
        "LIMIT 1",
      ].join(" "),
      [sessionUser.id],
    ),
    sql.query(
      [
        "SELECT html",
        "FROM user_todo_document_state",
        "WHERE user_id = $1",
        "LIMIT 1",
      ].join(" "),
      [sessionUser.id],
    ),
    sql.query(
      "SELECT COUNT(*)::int AS group_count FROM group_members WHERE user_id = $1",
      [sessionUser.id],
    ),
    sql.query(
      [
        "SELECT COUNT(*)::int AS unread_count",
        "FROM group_invites",
        "WHERE invitee_user_id = $1 AND status = 'pending' AND read_at IS NULL",
      ].join(" "),
      [sessionUser.id],
    ),
    sql.query(
      [
        "SELECT COUNT(*)::int AS unread_count",
        "FROM group_messages",
        "WHERE user_id = $1 AND is_read = FALSE",
      ].join(" "),
      [sessionUser.id],
    ),
    sql.query(
      [
        "SELECT COUNT(*)::int AS unread_count",
        "FROM direct_messages",
        "WHERE recipient_user_id = $1 AND is_read = FALSE",
      ].join(" "),
      [sessionUser.id],
    ),
  ]);
  const practiceSummary = summarizePracticeLogs(practiceRows[0]?.logs);
  const unreadMessages = Number(unreadInviteRows[0]?.unread_count || 0)
    + Number(unreadMessageRows[0]?.unread_count || 0)
    + Number(unreadDirectMessageRows[0]?.unread_count || 0);

  sendJson(response, 200, {
    dashboard: {
      cueCount: Number(cueRows[0]?.cue_count || 0),
      practiceDayCount: practiceSummary.dayCount,
      practiceTotalMinutes: practiceSummary.totalMinutes,
      todoCount: countTodoItems(todoRows[0]?.html),
      unreadMessageCount: unreadMessages,
      unreadDirectMessageCount: Number(unreadDirectMessageRows[0]?.unread_count || 0),
      groupCount: Number(groupRows[0]?.group_count || 0),
    },
  });
}

async function handleGetProfile(sql, response, sessionUser) {
  const rows = await sql.query(
    [
      "SELECT email, name, picture_url, picture_key, region, \"position\", genre, memo",
      "FROM app_users",
      "WHERE id = $1",
      "LIMIT 1",
    ].join(" "),
    [sessionUser.id],
  );

  sendJson(response, 200, {
    profile: normalizeProfileRow(rows[0], sessionUser),
  });
}

async function handleSaveProfile(sql, response, sessionUser, payload) {
  const name = normalizeProfileText(payload.name, 80);
  const region = normalizeProfileText(payload.region, 40);
  const position = normalizeProfileText(payload.position, 40);
  const genre = normalizeProfileText(payload.genre, 80);
  const memo = normalizeProfileText(payload.memo, 120);

  if (!name) {
    throwHttpError(400, "invalid_profile_name", "이름을 입력해 주세요.");
  }

  const rows = await sql.query(
    [
      "UPDATE app_users",
      "SET name = $2, region = $3, \"position\" = $4, genre = $5, memo = $6",
      "WHERE id = $1",
      "RETURNING email, name, picture_url, picture_key, region, \"position\", genre, memo",
    ].join(" "),
    [sessionUser.id, name, region, position, genre, memo],
  );

  sendJson(response, 200, {
    profile: normalizeProfileRow(rows[0], sessionUser),
  });
}

async function handlePresignImageUpload(sql, response, sessionUser, payload) {
  const upload = validateImageUploadRequest(payload);
  let presigned;

  try {
    presigned = await createPresignedImageUpload({
      userId: sessionUser.id,
      contentType: upload.contentType,
      size: upload.size,
    });
  } catch (error) {
    if (error.statusCode && error.errorCode) {
      throw error;
    }

    logStorageError("profile image presign error", error);
    throwHttpError(502, "upload_presign_failed", "이미지 업로드 주소를 발급하지 못했습니다.");
  }

  let rows;

  try {
    rows = await sql.query(
      "UPDATE app_users SET pending_picture_key = $2 WHERE id = $1 RETURNING id",
      [sessionUser.id, presigned.objectKey],
    );
  } catch {
    throwHttpError(500, "upload_record_db_save_failed", "이미지 업로드 정보를 DB에 저장하지 못했습니다.");
  }

  if (!rows[0]) {
    throwHttpError(404, "member_not_found", "회원 정보를 찾을 수 없습니다.");
  }

  sendJson(response, 200, {
    uploadUrl: presigned.uploadUrl,
    objectKey: presigned.objectKey,
  });
}

async function handleCompleteImageUpload(sql, response, sessionUser, payload) {
  const objectKey = typeof payload.objectKey === "string" ? payload.objectKey : "";

  if (!isOwnedImageObjectKey(objectKey, sessionUser.id)) {
    throwHttpError(403, "upload_object_not_owned", "현재 사용자의 이미지 경로가 아닙니다.");
  }

  let head;

  try {
    head = await headImageObject(objectKey);
  } catch (error) {
    if (isStorageObjectNotFound(error)) {
      await releasePendingImageUpload(sql, objectKey, sessionUser.id);
      throwHttpError(404, "uploaded_image_not_found", "업로드된 이미지를 찾을 수 없습니다.");
    }

    if (error.statusCode && error.errorCode) {
      throw error;
    }

    logStorageError("profile image head error", error);
    throwHttpError(502, "upload_verification_failed", "업로드 완료 여부를 확인하지 못했습니다.");
  }

  try {
    validateUploadedImageHead(head, objectKey);
  } catch (error) {
    const released = await releasePendingImageUpload(sql, objectKey, sessionUser.id);

    if (released) {
      await deleteImageObjectQuietly(objectKey, "invalid profile image cleanup error");
    }

    throw error;
  }

  let currentRows;
  let rows;

  try {
    [currentRows, rows] = await sql.transaction((txn) => [
      txn.query(
        [
          "SELECT email, name, picture_url, picture_key, pending_picture_key,",
          "region, \"position\", genre, memo",
          "FROM app_users WHERE id = $1 LIMIT 1 FOR UPDATE",
        ].join(" "),
        [sessionUser.id],
      ),
      txn.query(
        [
          "UPDATE app_users",
          "SET picture_key = $2, pending_picture_key = '', picture_url = ''",
          "WHERE id = $1 AND pending_picture_key = $2",
          "RETURNING email, name, picture_url, picture_key, region, \"position\", genre, memo",
        ].join(" "),
        [sessionUser.id, objectKey],
      ),
    ]);
  } catch {
    await cleanupImageAfterDatabaseFailure(sql, objectKey, sessionUser.id);
    throwHttpError(500, "profile_image_db_save_failed", "이미지 정보를 DB에 저장하지 못했습니다.");
  }

  const current = currentRows[0];

  if (!current) {
    await deleteImageObjectQuietly(objectKey, "missing profile image cleanup error");
    throwHttpError(404, "member_not_found", "회원 정보를 찾을 수 없습니다.");
  }

  const previousPictureKey = String(current.picture_key || "").trim();

  if (!rows[0]) {
    if (previousPictureKey === objectKey) {
      sendJson(response, 200, {
        objectKey,
        displayUrl: buildImageDisplayUrl(objectKey),
        profile: normalizeProfileRow(current, sessionUser),
      });
      return;
    }

    await deleteImageObjectQuietly(objectKey, "retired profile image cleanup error");
    throwHttpError(409, "upload_record_not_pending", "이미 만료되었거나 교체된 이미지 업로드입니다.");
  }

  const previousLegacyKey = getOwnedLegacyImageKey(current.picture_url, sessionUser.id);
  const previousOwnedKey = isOwnedImageObjectKey(previousPictureKey, sessionUser.id)
    ? previousPictureKey
    : previousLegacyKey;

  if (previousOwnedKey && previousOwnedKey !== objectKey) {
    await deleteImageObjectQuietly(previousOwnedKey, "old profile image delete error");
  }

  sendJson(response, 200, {
    objectKey,
    displayUrl: buildImageDisplayUrl(objectKey),
    profile: normalizeProfileRow(rows[0], sessionUser),
  });
}

async function handleDeleteProfileImage(sql, response, sessionUser) {
  const preflightRows = await sql.query(
    "SELECT picture_key, picture_url, pending_picture_key FROM app_users WHERE id = $1 LIMIT 1",
    [sessionUser.id],
  );
  const preflight = preflightRows[0];

  if (!preflight) {
    throwHttpError(404, "member_not_found", "회원 정보를 찾을 수 없습니다.");
  }

  const preflightOwnedKeys = getOwnedProfileImageKeys(preflight, sessionUser.id);

  if (preflightOwnedKeys.length) {
    getR2Storage();
  }

  const [currentRows, rows] = await sql.transaction((txn) => [
    txn.query(
      "SELECT picture_key, picture_url, pending_picture_key FROM app_users WHERE id = $1 LIMIT 1 FOR UPDATE",
      [sessionUser.id],
    ),
    txn.query(
      [
        "UPDATE app_users SET picture_key = '', pending_picture_key = '', picture_url = '' WHERE id = $1",
        "RETURNING email, name, picture_url, picture_key, region, \"position\", genre, memo",
      ].join(" "),
      [sessionUser.id],
    ),
  ]);
  const current = currentRows[0];

  if (!current || !rows[0]) {
    for (const objectKey of preflightOwnedKeys) {
      await deleteImageObjectQuietly(objectKey, "missing profile image delete error");
    }

    throwHttpError(404, "member_not_found", "회원 정보를 찾을 수 없습니다.");
  }

  const ownedKeys = getOwnedProfileImageKeys(current, sessionUser.id);

  if (ownedKeys.length && !preflightOwnedKeys.length) {
    getR2Storage();
  }

  for (const objectKey of ownedKeys) {
    await deleteImageObjectQuietly(objectKey, "profile image delete error");
  }

  sendJson(response, 200, {
    profile: normalizeProfileRow(rows[0], sessionUser),
  });
}

function getOwnedProfileImageKeys(row, userId) {
  const pictureKey = String(row?.picture_key || "").trim();
  const pendingPictureKey = String(row?.pending_picture_key || "").trim();
  const ownedKeys = new Set();

  if (isOwnedImageObjectKey(pictureKey, userId)) {
    ownedKeys.add(pictureKey);
  } else {
    const legacyKey = getOwnedLegacyImageKey(row?.picture_url, userId);

    if (legacyKey) {
      ownedKeys.add(legacyKey);
    }
  }

  if (isOwnedImageObjectKey(pendingPictureKey, userId)) {
    ownedKeys.add(pendingPictureKey);
  }

  return [...ownedKeys];
}

function getOwnedLegacyImageKey(value, userId) {
  const publicBaseUrl = normalizePublicBaseUrl(process.env.R2_PUBLIC_BASE_URL);

  return publicBaseUrl
    ? getOwnedLegacyProfileImageKey(value, userId, publicBaseUrl)
    : "";
}

async function deleteImageObjectQuietly(objectKey, label) {
  try {
    await deleteImageObject(objectKey);
  } catch (error) {
    logStorageError(label, error);
  }
}

async function cleanupImageAfterDatabaseFailure(sql, objectKey, userId) {
  const released = await releasePendingImageUpload(sql, objectKey, userId);

  if (released) {
    await deleteImageObjectQuietly(objectKey, "new profile image cleanup error");
  }
}

async function releasePendingImageUpload(sql, objectKey, userId) {
  try {
    const rows = await sql.query(
      [
        "UPDATE app_users SET pending_picture_key = ''",
        "WHERE id = $1 AND pending_picture_key = $2 AND picture_key <> $2",
        "RETURNING id",
      ].join(" "),
      [userId, objectKey],
    );

    return Boolean(rows[0]);
  } catch (error) {
    logStorageError("pending profile image release deferred after database error", error);
    return false;
  }
}

function logStorageError(label, error) {
  console.error(label, getSafeStorageErrorDetails(error));
}

async function handleCreateGroup(sql, response, sessionUser, payload) {
  const name = normalizeGroupName(payload.name);

  if (!name) {
    throwHttpError(400, "invalid_group_name", "그룹 이름을 입력해 주세요.");
  }

  const [rows] = await sql.transaction((txn) => [
    txn`
      WITH created_group AS (
        INSERT INTO groups (name, owner_user_id, updated_at)
        VALUES (${name}, ${sessionUser.id}, NOW())
        RETURNING id, name, created_at, updated_at
      ),
      created_member AS (
        INSERT INTO group_members (group_id, user_id, role)
        SELECT id, ${sessionUser.id}, 'owner'
        FROM created_group
        ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner'
        RETURNING group_id, role
      )
      SELECT
        created_group.id,
        created_group.name,
        created_member.role,
        created_group.created_at,
        created_group.updated_at
      FROM created_group
      JOIN created_member ON created_member.group_id = created_group.id
    `,
  ]);

  sendJson(response, 201, {
    group: normalizeGroupRow(rows[0]),
  });
}

async function handleCreateInvite(sql, response, sessionUser, payload) {
  const groupId = normalizePositiveId(payload.groupId);
  const email = normalizeEmail(payload.email);

  if (!groupId) {
    throwHttpError(400, "invalid_group_id", "초대할 그룹을 선택해 주세요.");
  }

  if (!isValidEmail(email)) {
    throwHttpError(400, "invalid_email", "초대할 이메일 주소를 확인해 주세요.");
  }

  const ownerRows = await sql.query(
    [
      "SELECT g.id, g.name",
      "FROM groups g",
      "JOIN group_members gm ON gm.group_id = g.id",
      "WHERE g.id = $1 AND gm.user_id = $2 AND gm.role = 'owner'",
      "LIMIT 1",
    ].join(" "),
    [groupId, sessionUser.id],
  );

  if (!ownerRows[0]) {
    throwHttpError(403, "not_group_owner", "그룹 owner만 초대할 수 있습니다.");
  }

  const inviteeRows = await sql.query(
    "SELECT id, email FROM app_users WHERE email = $1 LIMIT 1",
    [email],
  );
  const invitee = inviteeRows[0];

  if (!invitee) {
    throwHttpError(404, "invitee_not_found", "가입된 이메일을 찾을 수 없습니다.");
  }

  if (String(invitee.id) === String(sessionUser.id)) {
    throwHttpError(409, "self_invite_not_allowed", "자기 자신은 초대할 수 없습니다.");
  }

  const memberRows = await sql.query(
    "SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1",
    [groupId, invitee.id],
  );

  if (memberRows[0]) {
    throwHttpError(409, "already_group_member", "이미 그룹 멤버인 사용자입니다.");
  }

  const pendingRows = await sql.query(
    [
      "SELECT 1 FROM group_invites",
      "WHERE group_id = $1 AND invitee_user_id = $2 AND status = 'pending'",
      "LIMIT 1",
    ].join(" "),
    [groupId, invitee.id],
  );

  if (pendingRows[0]) {
    throwHttpError(409, "pending_invite_exists", "이미 대기 중인 초대가 있습니다.");
  }

  try {
    const token = crypto.randomBytes(24).toString("base64url");
    const rows = await sql.query(
      [
        "INSERT INTO group_invites (group_id, inviter_user_id, invitee_user_id, invitee_email, token)",
        "VALUES ($1, $2, $3, $4, $5)",
        "RETURNING id, group_id, status, created_at",
      ].join(" "),
      [groupId, sessionUser.id, invitee.id, invitee.email, token],
    );

    sendJson(response, 201, {
      invite: normalizeInviteRow({
        ...rows[0],
        group_name: ownerRows[0].name,
        inviter_email: sessionUser.email,
      }),
    });
  } catch (error) {
    if (error.code === "23505") {
      throwHttpError(409, "pending_invite_exists", "이미 대기 중인 초대가 있습니다.");
    }

    throw error;
  }
}

async function handleGetMessages(sql, response, sessionUser) {
  const [inviteRows, noticeRows, directMessageRows] = await Promise.all([
    sql.query(
      [
        "SELECT",
        "i.id, i.group_id, i.status, i.created_at, i.responded_at, i.read_at,",
        "g.name AS group_name,",
        "u.email AS inviter_email,",
        "u.name AS inviter_name",
        "FROM group_invites i",
        "JOIN groups g ON g.id = i.group_id",
        "JOIN app_users u ON u.id = i.inviter_user_id",
        "WHERE i.invitee_user_id = $1",
        "ORDER BY i.created_at DESC",
        "LIMIT 30",
      ].join(" "),
      [sessionUser.id],
    ),
    sql.query(
      [
        "SELECT",
        "m.id, m.group_id, m.type, m.title, m.body, m.is_read, m.created_at,",
        "g.name AS group_name",
        "FROM group_messages m",
        "JOIN groups g ON g.id = m.group_id",
        "WHERE m.user_id = $1",
        "ORDER BY m.created_at DESC",
        "LIMIT 30",
      ].join(" "),
      [sessionUser.id],
    ),
    sql.query(
      [
        "SELECT",
        "m.id, m.recruit_post_id, m.subject, m.body, m.is_read, m.created_at,",
        "sender.id AS sender_user_id, sender.email AS sender_email,",
        "COALESCE(NULLIF(sender.name, ''), 'Cue Sheet 멤버') AS sender_name",
        "FROM direct_messages m",
        "JOIN app_users sender ON sender.id = m.sender_user_id",
        "WHERE m.recipient_user_id = $1",
        "ORDER BY m.created_at DESC",
        "LIMIT 30",
      ].join(" "),
      [sessionUser.id],
    ),
  ]);
  const messages = [
    ...inviteRows.map(normalizeInviteRow),
    ...noticeRows.map(normalizeGroupMessageRow),
    ...directMessageRows.map(normalizeDirectMessageRow),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  sendJson(response, 200, {
    messages: messages.slice(0, 40),
  });
}

async function handleGetUnreadDirectMessageCount(sql, response, sessionUser) {
  const rows = await sql.query(
    [
      "SELECT COUNT(*)::int AS unread_count",
      "FROM direct_messages",
      "WHERE recipient_user_id = $1 AND is_read = FALSE",
    ].join(" "),
    [sessionUser.id],
  );

  sendJson(response, 200, {
    unreadDirectMessageCount: Number(rows[0]?.unread_count || 0),
  });
}

async function handleReadMessage(sql, response, sessionUser, payload) {
  const messageId = normalizePositiveId(payload.messageId || payload.inviteId);
  const messageType = String(payload.type || payload.messageType || "invite");

  if (!messageId) {
    throwHttpError(400, "invalid_message_id", "메시지를 확인해 주세요.");
  }

  if (messageType === "group_message") {
    const rows = await sql.query(
      [
        "UPDATE group_messages",
        "SET is_read = TRUE",
        "WHERE id = $1 AND user_id = $2",
        "RETURNING id",
      ].join(" "),
      [messageId, sessionUser.id],
    );

    if (!rows[0]) {
      await throwMissingOrForbiddenMessage(sql, "group_message", messageId);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (messageType === "direct_message") {
    const rows = await sql.query(
      [
        "UPDATE direct_messages",
        "SET is_read = TRUE",
        "WHERE id = $1 AND recipient_user_id = $2",
        "RETURNING id",
      ].join(" "),
      [messageId, sessionUser.id],
    );

    if (!rows[0]) {
      await throwMissingOrForbiddenMessage(sql, "direct_message", messageId);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  const rows = await sql.query(
    [
      "UPDATE group_invites",
      "SET read_at = COALESCE(read_at, NOW())",
      "WHERE id = $1 AND invitee_user_id = $2",
      "RETURNING id",
    ].join(" "),
    [messageId, sessionUser.id],
  );

  if (!rows[0]) {
    await throwMissingOrForbiddenMessage(sql, "invite", messageId);
  }

  sendJson(response, 200, { ok: true });
}

async function handleAcceptMessage(sql, response, sessionUser, payload) {
  const inviteId = normalizePositiveId(payload.inviteId);

  if (!inviteId) {
    throwHttpError(400, "invalid_invite_id", "초대 메시지를 확인해 주세요.");
  }

  const [rows] = await sql.transaction((txn) => [
    txn`
      WITH target_invite AS (
        SELECT id, group_id, invitee_user_id
        FROM group_invites
        WHERE id = ${inviteId}
          AND invitee_user_id = ${sessionUser.id}
          AND status = 'pending'
      ),
      inserted_member AS (
        INSERT INTO group_members (group_id, user_id, role)
        SELECT group_id, ${sessionUser.id}, 'member'
        FROM target_invite
        ON CONFLICT (group_id, user_id) DO NOTHING
        RETURNING group_id
      ),
      updated_invite AS (
        UPDATE group_invites
        SET status = 'accepted', responded_at = NOW(), accepted_at = NOW(), read_at = COALESCE(read_at, NOW())
        WHERE id IN (SELECT id FROM target_invite)
        RETURNING id, group_id, status, created_at, responded_at
      )
      SELECT
        updated_invite.id,
        updated_invite.group_id,
        updated_invite.status,
        updated_invite.created_at,
        updated_invite.responded_at,
        g.name AS group_name,
        u.email AS inviter_email,
        u.name AS inviter_name
      FROM updated_invite
      JOIN group_invites i ON i.id = updated_invite.id
      JOIN groups g ON g.id = updated_invite.group_id
      JOIN app_users u ON u.id = i.inviter_user_id
    `,
  ]);

  if (!rows[0]) {
    await throwMissingOrForbiddenInvite(sql, inviteId, "invite_not_acceptable", "수락할 수 있는 초대가 아닙니다.");
  }

  sendJson(response, 200, {
    invite: normalizeInviteRow(rows[0]),
  });
}

async function handleRejectInvite(sql, response, sessionUser, payload) {
  const inviteId = normalizePositiveId(payload.inviteId || payload.messageId);

  if (!inviteId) {
    throwHttpError(400, "invalid_invite_id", "초대 메시지를 확인해 주세요.");
  }

  const rows = await sql.query(
    [
      "UPDATE group_invites",
      "SET status = 'rejected', responded_at = NOW(), rejected_at = NOW(), read_at = COALESCE(read_at, NOW())",
      "WHERE id = $1 AND invitee_user_id = $2 AND status = 'pending'",
      "RETURNING id, group_id, status, created_at, responded_at",
    ].join(" "),
    [inviteId, sessionUser.id],
  );

  if (!rows[0]) {
    await throwMissingOrForbiddenInvite(sql, inviteId, "invite_not_rejectable", "거절할 수 있는 초대가 아닙니다.");
  }

  sendJson(response, 200, {
    invite: normalizeInviteRow(rows[0]),
  });
}

async function handleGetMemo(sql, response, sessionUser) {
  const rows = await sql.query(
    "SELECT content, updated_at FROM user_memos WHERE user_id = $1 LIMIT 1",
    [sessionUser.id],
  );

  sendJson(response, 200, {
    content: normalizeMemoContent(rows[0]?.content),
    updatedAt: rows[0]?.updated_at ?? null,
  });
}

async function handleSaveMemo(sql, response, sessionUser, payload) {
  const content = normalizeMemoContent(payload.content);
  const rows = await sql.query(
    [
      "INSERT INTO user_memos (user_id, content, updated_at)",
      "VALUES ($1, $2, NOW())",
      "ON CONFLICT (user_id)",
      "DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()",
      "RETURNING content, updated_at",
    ].join(" "),
    [sessionUser.id, content],
  );

  sendJson(response, 200, {
    content: normalizeMemoContent(rows[0]?.content),
    updatedAt: rows[0]?.updated_at ?? null,
  });
}

function normalizeGroupName(value) {
  return String(value || "").trim().slice(0, MAX_GROUP_NAME_LENGTH);
}

function normalizeMemoContent(value) {
  return String(value || "").slice(0, MAX_MEMO_LENGTH);
}

function normalizeProfileText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePositiveId(value) {
  const id = String(value || "").trim();

  return /^\d+$/.test(id) ? id : "";
}

function normalizeGroupRow(row) {
  return {
    id: String(row?.id || ""),
    name: String(row?.name || ""),
    role: row?.role === "owner" ? "owner" : "member",
    memberCount: Number(row?.member_count || 0),
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizeBandRow(row) {
  return {
    id: String(row?.id || ""),
    name: String(row?.name || "").trim(),
    description: String(row?.description || "").trim(),
    memberCount: Number(row?.member_count || 0),
    ownerName: String(row?.owner_name || "").trim(),
    ownerRegion: String(row?.owner_region || "").trim(),
    ownerGenre: String(row?.owner_genre || "").trim(),
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizeInviteRow(row) {
  return {
    id: String(row?.id || ""),
    type: "invite",
    groupId: String(row?.group_id || ""),
    groupName: String(row?.group_name || ""),
    title: `${String(row?.group_name || "그룹").trim() || "그룹"} 초대`,
    body: "",
    inviterEmail: normalizeEmail(row?.inviter_email),
    inviterName: String(row?.inviter_name || "").trim(),
    status: ["pending", "accepted", "rejected"].includes(row?.status) ? row.status : "pending",
    isRead: Boolean(row?.read_at),
    createdAt: row?.created_at ?? null,
    respondedAt: row?.responded_at ?? null,
  };
}

function normalizeGroupMessageRow(row) {
  return {
    id: String(row?.id || ""),
    type: "group_message",
    messageType: ["notice", "cue_request"].includes(row?.type) ? row.type : "notice",
    groupId: String(row?.group_id || ""),
    groupName: String(row?.group_name || ""),
    title: String(row?.title || "").trim() || "그룹 알림",
    body: String(row?.body || "").trim(),
    status: "notice",
    isRead: Boolean(row?.is_read),
    createdAt: row?.created_at ?? null,
    respondedAt: null,
  };
}

function normalizeDirectMessageRow(row) {
  return {
    id: String(row?.id || ""),
    type: "direct_message",
    messageType: "recruit_contact",
    postId: String(row?.recruit_post_id || ""),
    title: String(row?.subject || "").trim() || "게시글 쪽지",
    body: String(row?.body || "").trim(),
    senderName: String(row?.sender_name || "Cue Sheet 멤버").trim(),
    senderId: getPublicMemberId(row?.sender_email, row?.sender_user_id),
    status: "message",
    isRead: Boolean(row?.is_read),
    createdAt: row?.created_at ?? null,
    respondedAt: null,
  };
}

function normalizeProfileRow(row, sessionUser) {
  const pictureKey = String(row?.picture_key || "").trim();

  return {
    email: normalizeEmail(row?.email || sessionUser?.email),
    name: String(row?.name || "").trim(),
    pictureKey,
    pictureUrl: resolveProfilePictureUrl(row),
    region: String(row?.region || "").trim(),
    position: String(row?.position || "").trim(),
    genre: String(row?.genre || "").trim(),
    memo: String(row?.memo || "").trim(),
  };
}

function normalizeDirectoryRow(row) {
  const name = String(row?.name || "").trim();
  const position = String(row?.position || "").trim();
  const region = String(row?.region || "").trim();
  const genre = String(row?.genre || "").trim();

  return {
    id: String(row?.id || ""),
    name: name || "이름 없는 회원",
    pictureUrl: resolveProfilePictureUrl(row),
    region,
    position,
    genre,
    memo: String(row?.memo || "").trim(),
  };
}

function summarizePracticeLogs(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      dayCount: 0,
      totalMinutes: 0,
    };
  }

  let dayCount = 0;
  let totalMinutes = 0;

  for (const entries of Object.values(value)) {
    if (!Array.isArray(entries) || entries.length === 0) {
      continue;
    }

    dayCount += 1;

    for (const entry of entries) {
      const minutes = Number(entry?.minutes);

      if (Number.isFinite(minutes) && minutes > 0) {
        totalMinutes += Math.floor(minutes);
      }
    }
  }

  return {
    dayCount,
    totalMinutes,
  };
}

function countTodoItems(html) {
  const text = String(html || "");
  const checkRows = text.match(/class=(?:"[^"]*\btodo-check-row\b[^"]*"|'[^']*\btodo-check-row\b[^']*')/g);

  if (checkRows?.length) {
    return checkRows.length;
  }

  return text.trim() ? 1 : 0;
}

async function throwMissingOrForbiddenMessage(sql, type, messageId) {
  if (type === "direct_message") {
    const rows = await sql.query(
      "SELECT 1 FROM direct_messages WHERE id = $1 LIMIT 1",
      [messageId],
    );

    throwHttpError(
      rows[0] ? 403 : 404,
      rows[0] ? "message_not_readable" : "message_not_found",
      rows[0] ? "읽음 처리할 수 있는 메시지가 아닙니다." : "메시지를 찾을 수 없습니다.",
    );
  }

  if (type === "group_message") {
    const rows = await sql.query(
      "SELECT 1 FROM group_messages WHERE id = $1 LIMIT 1",
      [messageId],
    );

    throwHttpError(
      rows[0] ? 403 : 404,
      rows[0] ? "message_not_readable" : "message_not_found",
      rows[0] ? "읽음 처리할 수 있는 메시지가 아닙니다." : "메시지를 찾을 수 없습니다.",
    );
  }

  const rows = await sql.query(
    "SELECT 1 FROM group_invites WHERE id = $1 LIMIT 1",
    [messageId],
  );

  throwHttpError(
    rows[0] ? 403 : 404,
    rows[0] ? "message_not_readable" : "message_not_found",
    rows[0] ? "읽음 처리할 수 있는 메시지가 아닙니다." : "메시지를 찾을 수 없습니다.",
  );
}

function getPublicMemberId(email, userId) {
  const normalizedEmail = normalizeEmail(email);
  const localPart = normalizedEmail.includes("@") ? normalizedEmail.split("@")[0] : "";

  return localPart
    ? `@${localPart}`
    : `@member-${String(userId || "").trim() || "unknown"}`;
}

async function throwMissingOrForbiddenInvite(sql, inviteId, errorCode, message) {
  const rows = await sql.query(
    "SELECT 1 FROM group_invites WHERE id = $1 LIMIT 1",
    [inviteId],
  );

  throwHttpError(
    rows[0] ? 403 : 404,
    rows[0] ? errorCode : "invite_not_found",
    rows[0] ? message : "초대 메시지를 찾을 수 없습니다.",
  );
}

function throwHttpError(statusCode, errorCode, message) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;
  throw error;
}
