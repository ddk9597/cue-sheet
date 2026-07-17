const crypto = require("node:crypto");

const {
  getSessionUser,
  isValidEmail,
  normalizeEmail,
} = require("../auth");
const { normalizeCueList } = require("../cues");
const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const { resolveProfilePictureUrl } = require("../r2");

const MAX_GROUP_NAME_LENGTH = 80;
const MAX_GROUP_DESCRIPTION_LENGTH = 500;
const MAX_GROUP_CUE_TITLE_LENGTH = 100;
const MAX_GROUP_MESSAGE_TITLE_LENGTH = 120;
const MAX_GROUP_MESSAGE_BODY_LENGTH = 1000;

module.exports = async (request, response) => {
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

    const sessionUser = await getSessionUser(sql, request);

    if (!sessionUser) {
      sendJson(response, 401, {
        error: "not_authenticated",
        message: "로그인 후 사용할 수 있습니다.",
      });
      return;
    }

    const segments = getGroupRouteSegments(request);

    if (segments.length === 1 && segments[0] === "create") {
      if (request.method !== "POST") {
        methodNotAllowed(response, ["POST"]);
        return;
      }

      await handleCreateGroup(sql, response, sessionUser, await readJsonBody(request));
      return;
    }

    if (segments.length === 1 && segments[0] === "list") {
      if (request.method !== "GET") {
        methodNotAllowed(response, ["GET"]);
        return;
      }

      await handleListGroups(sql, response, sessionUser);
      return;
    }

    const groupId = normalizePositiveId(segments[0]);

    if (!groupId) {
      sendJson(response, 404, {
        error: "group_route_not_found",
        message: "그룹 API 경로를 찾을 수 없습니다.",
      });
      return;
    }

    if (segments.length === 1) {
      if (request.method !== "GET") {
        methodNotAllowed(response, ["GET"]);
        return;
      }

      await handleGetGroup(sql, response, sessionUser, groupId);
      return;
    }

    if (segments.length === 2 && segments[1] === "members") {
      if (request.method !== "GET") {
        methodNotAllowed(response, ["GET"]);
        return;
      }

      await handleGetMembers(sql, response, sessionUser, groupId);
      return;
    }

    if (segments.length === 2 && segments[1] === "invites") {
      if (request.method !== "POST") {
        methodNotAllowed(response, ["POST"]);
        return;
      }

      await handleCreateInvite(sql, response, sessionUser, groupId, await readJsonBody(request));
      return;
    }

    if (segments.length === 2 && segments[1] === "cues") {
      if (request.method === "GET") {
        await handleListGroupCues(sql, response, sessionUser, groupId);
        return;
      }

      if (request.method === "POST") {
        await handleCreateGroupCue(sql, response, sessionUser, groupId, await readJsonBody(request));
        return;
      }

      methodNotAllowed(response, ["GET", "POST"]);
      return;
    }

    if (segments.length === 3 && segments[1] === "cues") {
      const cueId = normalizePositiveId(segments[2]);

      if (!cueId) {
        throwHttpError(400, "invalid_cue_id", "그룹 큐시트를 확인해 주세요.");
      }

      if (request.method === "GET") {
        await handleGetGroupCue(sql, response, sessionUser, groupId, cueId);
        return;
      }

      if (request.method === "PUT") {
        await handleUpdateGroupCue(sql, response, sessionUser, groupId, cueId, await readJsonBody(request));
        return;
      }

      if (request.method === "DELETE") {
        await handleDeleteGroupCue(sql, response, sessionUser, groupId, cueId);
        return;
      }

      methodNotAllowed(response, ["GET", "PUT", "DELETE"]);
      return;
    }

    if (segments.length === 2 && segments[1] === "messages") {
      if (request.method === "GET") {
        await handleListGroupMessages(sql, response, sessionUser, groupId);
        return;
      }

      if (request.method === "POST") {
        await handleCreateGroupMessage(sql, response, sessionUser, groupId, await readJsonBody(request));
        return;
      }

      methodNotAllowed(response, ["GET", "POST"]);
      return;
    }

    sendJson(response, 404, {
      error: "group_route_not_found",
      message: "그룹 API 경로를 찾을 수 없습니다.",
    });
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
      console.error("groups api error", error);
    }

    sendJson(response, statusCode, {
      error: error.errorCode || "groups_api_failed",
      message: error.message || "그룹 요청을 처리하지 못했습니다.",
    });
  }
};

function getGroupRouteSegments(request) {
  const queryPath = request.query?.path;
  const parts = Array.isArray(queryPath)
    ? queryPath
    : typeof queryPath === "string"
      ? queryPath.split("/")
      : new URL(request.url || "", `http://${request.headers.host || "localhost"}`)
        .pathname
        .replace(/^\/api\/groups\/?/, "")
        .split("/");

  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part, index) => !(index === 0 && part === "groups"));
}

async function handleCreateGroup(sql, response, sessionUser, payload) {
  const name = normalizeText(payload.name, MAX_GROUP_NAME_LENGTH);
  const description = normalizeText(payload.description, MAX_GROUP_DESCRIPTION_LENGTH);

  if (!name) {
    throwHttpError(400, "invalid_group_name", "그룹 이름을 입력해 주세요.");
  }

  const [rows] = await sql.transaction((txn) => [
    txn`
      WITH created_group AS (
        INSERT INTO groups (name, description, owner_user_id, updated_at)
        VALUES (${name}, ${description}, ${sessionUser.id}, NOW())
        RETURNING id, name, description, owner_user_id, created_at, updated_at
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
        created_group.description,
        created_group.owner_user_id,
        created_member.role,
        1::int AS member_count,
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

async function handleListGroups(sql, response, sessionUser) {
  const rows = await sql.query(
    [
      "SELECT",
      "g.id, g.name, g.description, g.owner_user_id, gm.role, g.created_at, g.updated_at,",
      "COUNT(all_members.user_id)::int AS member_count",
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

async function handleGetGroup(sql, response, sessionUser, groupId) {
  const access = await requireGroupAccess(sql, sessionUser, groupId);

  sendJson(response, 200, {
    group: normalizeGroupRow(access.group),
  });
}

async function handleGetMembers(sql, response, sessionUser, groupId) {
  await requireGroupAccess(sql, sessionUser, groupId);

  const rows = await sql.query(
    [
      "SELECT",
      "u.id, u.email, u.name, u.picture_url, u.picture_key, u.region, u.\"position\", u.genre,",
      "gm.role, gm.created_at",
      "FROM group_members gm",
      "JOIN app_users u ON u.id = gm.user_id",
      "WHERE gm.group_id = $1",
      "ORDER BY CASE gm.role WHEN 'owner' THEN 0 ELSE 1 END, gm.created_at ASC",
    ].join(" "),
    [groupId],
  );

  sendJson(response, 200, {
    members: rows.map(normalizeMemberRow),
  });
}

async function handleCreateInvite(sql, response, sessionUser, groupId, payload) {
  const access = await requireGroupAccess(sql, sessionUser, groupId);

  if (access.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 초대할 수 있습니다.");
  }

  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    throwHttpError(400, "invalid_email", "초대할 이메일 주소를 확인해 주세요.");
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

  const token = crypto.randomBytes(24).toString("base64url");

  try {
    const rows = await sql.query(
      [
        "INSERT INTO group_invites (group_id, inviter_user_id, invitee_user_id, invitee_email, token)",
        "VALUES ($1, $2, $3, $4, $5)",
        "RETURNING id, group_id, invitee_email, status, created_at",
      ].join(" "),
      [groupId, sessionUser.id, invitee.id, invitee.email, token],
    );

    sendJson(response, 201, {
      invite: normalizeInviteRow({
        ...rows[0],
        group_name: access.group.name,
      }),
    });
  } catch (error) {
    if (error.code === "23505") {
      throwHttpError(409, "pending_invite_exists", "이미 대기 중인 초대가 있습니다.");
    }

    throw error;
  }
}

async function handleListGroupCues(sql, response, sessionUser, groupId) {
  await requireGroupAccess(sql, sessionUser, groupId);

  const rows = await sql.query(
    [
      "SELECT",
      "gc.id, gc.group_id, gc.title, gc.cue_data, gc.created_at, gc.updated_at,",
      "creator.name AS created_by_name, updater.name AS updated_by_name",
      "FROM group_cues gc",
      "LEFT JOIN app_users creator ON creator.id = gc.created_by",
      "LEFT JOIN app_users updater ON updater.id = gc.updated_by",
      "WHERE gc.group_id = $1",
      "ORDER BY gc.updated_at DESC, gc.created_at DESC",
    ].join(" "),
    [groupId],
  );

  sendJson(response, 200, {
    cues: rows.map(normalizeGroupCueSummaryRow),
  });
}

async function handleCreateGroupCue(sql, response, sessionUser, groupId, payload) {
  const access = await requireGroupAccess(sql, sessionUser, groupId);

  if (access.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 그룹 큐시트를 저장할 수 있습니다.");
  }

  const title = normalizeText(payload.title, MAX_GROUP_CUE_TITLE_LENGTH);
  const items = normalizeCueList(payload.items);

  if (!title) {
    throwHttpError(400, "invalid_group_cue_title", "그룹 큐시트 제목을 입력해 주세요.");
  }

  const rows = await sql.query(
    [
      "INSERT INTO group_cues (group_id, title, cue_data, created_by, updated_by, updated_at)",
      "VALUES ($1, $2, $3::jsonb, $4, $4, NOW())",
      "RETURNING id, group_id, title, cue_data, created_at, updated_at",
    ].join(" "),
    [groupId, title, JSON.stringify(items), sessionUser.id],
  );

  await touchGroup(sql, groupId);

  sendJson(response, 201, {
    cue: normalizeGroupCueRow(rows[0]),
  });
}

async function handleGetGroupCue(sql, response, sessionUser, groupId, cueId) {
  await requireGroupAccess(sql, sessionUser, groupId);

  const rows = await sql.query(
    [
      "SELECT id, group_id, title, cue_data, created_at, updated_at",
      "FROM group_cues",
      "WHERE id = $1 AND group_id = $2",
      "LIMIT 1",
    ].join(" "),
    [cueId, groupId],
  );

  if (!rows[0]) {
    throwHttpError(404, "group_cue_not_found", "그룹 큐시트를 찾을 수 없습니다.");
  }

  sendJson(response, 200, {
    cue: normalizeGroupCueRow(rows[0]),
  });
}

async function handleUpdateGroupCue(sql, response, sessionUser, groupId, cueId, payload) {
  const access = await requireGroupAccess(sql, sessionUser, groupId);

  if (access.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 그룹 큐시트를 수정할 수 있습니다.");
  }

  const title = normalizeText(payload.title, MAX_GROUP_CUE_TITLE_LENGTH);
  const items = normalizeCueList(payload.items);

  if (!title) {
    throwHttpError(400, "invalid_group_cue_title", "그룹 큐시트 제목을 입력해 주세요.");
  }

  const rows = await sql.query(
    [
      "UPDATE group_cues",
      "SET title = $3, cue_data = $4::jsonb, updated_by = $5, updated_at = NOW()",
      "WHERE id = $1 AND group_id = $2",
      "RETURNING id, group_id, title, cue_data, created_at, updated_at",
    ].join(" "),
    [cueId, groupId, title, JSON.stringify(items), sessionUser.id],
  );

  if (!rows[0]) {
    throwHttpError(404, "group_cue_not_found", "그룹 큐시트를 찾을 수 없습니다.");
  }

  await touchGroup(sql, groupId);

  sendJson(response, 200, {
    cue: normalizeGroupCueRow(rows[0]),
  });
}

async function handleDeleteGroupCue(sql, response, sessionUser, groupId, cueId) {
  const access = await requireGroupAccess(sql, sessionUser, groupId);

  if (access.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 삭제할 수 있습니다.");
  }

  const rows = await sql.query(
    [
      "DELETE FROM group_cues",
      "WHERE id = $1 AND group_id = $2",
      "RETURNING id",
    ].join(" "),
    [cueId, groupId],
  );

  if (!rows[0]) {
    throwHttpError(404, "group_cue_not_found", "그룹 큐시트를 찾을 수 없습니다.");
  }

  await touchGroup(sql, groupId);

  sendJson(response, 200, {
    ok: true,
  });
}

async function handleListGroupMessages(sql, response, sessionUser, groupId) {
  await requireGroupAccess(sql, sessionUser, groupId);

  const rows = await sql.query(
    [
      "SELECT id, group_id, type, title, body, is_read, created_at",
      "FROM group_messages",
      "WHERE group_id = $1 AND user_id = $2",
      "ORDER BY created_at DESC",
      "LIMIT 30",
    ].join(" "),
    [groupId, sessionUser.id],
  );

  sendJson(response, 200, {
    messages: rows.map(normalizeGroupMessageRow),
  });
}

async function handleCreateGroupMessage(sql, response, sessionUser, groupId, payload) {
  const access = await requireGroupAccess(sql, sessionUser, groupId);

  if (access.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 공지를 보낼 수 있습니다.");
  }

  const title = normalizeText(payload.title, MAX_GROUP_MESSAGE_TITLE_LENGTH);
  const body = normalizeText(payload.body, MAX_GROUP_MESSAGE_BODY_LENGTH);

  if (!title) {
    throwHttpError(400, "invalid_message_title", "공지 제목을 입력해 주세요.");
  }

  const rows = await sql.query(
    [
      "INSERT INTO group_messages (group_id, user_id, type, title, body, is_read)",
      "SELECT $1, user_id, 'notice', $2, $3, user_id = $4",
      "FROM group_members",
      "WHERE group_id = $1",
      "RETURNING id, group_id, type, title, body, is_read, created_at",
    ].join(" "),
    [groupId, title, body, sessionUser.id],
  );

  await touchGroup(sql, groupId);

  sendJson(response, 201, {
    messages: rows.map(normalizeGroupMessageRow),
  });
}

async function requireGroupAccess(sql, sessionUser, groupId) {
  const rows = await sql.query(
    [
      "SELECT",
      "g.id, g.name, g.description, g.owner_user_id, g.created_at, g.updated_at,",
      "gm.role, COUNT(all_members.user_id)::int AS member_count",
      "FROM groups g",
      "LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $2",
      "LEFT JOIN group_members all_members ON all_members.group_id = g.id",
      "WHERE g.id = $1",
      "GROUP BY g.id, gm.role",
      "LIMIT 1",
    ].join(" "),
    [groupId, sessionUser.id],
  );
  const group = rows[0];

  if (!group) {
    throwHttpError(404, "group_not_found", "그룹을 찾을 수 없습니다.");
  }

  if (!group.role) {
    throwHttpError(403, "not_group_member", "그룹 멤버만 접근할 수 있습니다.");
  }

  return {
    group,
    role: group.role === "owner" ? "owner" : "member",
  };
}

async function touchGroup(sql, groupId) {
  await sql.query(
    "UPDATE groups SET updated_at = NOW() WHERE id = $1",
    [groupId],
  );
}

function normalizeText(value, maxLength) {
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
    description: String(row?.description || ""),
    ownerUserId: String(row?.owner_user_id || ""),
    role: row?.role === "owner" ? "owner" : "member",
    memberCount: Number(row?.member_count || 0),
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizeMemberRow(row) {
  return {
    id: String(row?.id || ""),
    email: normalizeEmail(row?.email),
    name: String(row?.name || "").trim(),
    pictureUrl: resolveProfilePictureUrl(row),
    region: String(row?.region || "").trim(),
    position: String(row?.position || "").trim(),
    genre: String(row?.genre || "").trim(),
    role: row?.role === "owner" ? "owner" : "member",
    createdAt: row?.created_at ?? null,
  };
}

function normalizeInviteRow(row) {
  return {
    id: String(row?.id || ""),
    groupId: String(row?.group_id || ""),
    groupName: String(row?.group_name || ""),
    inviteeEmail: normalizeEmail(row?.invitee_email),
    status: ["pending", "accepted", "rejected"].includes(row?.status) ? row.status : "pending",
    createdAt: row?.created_at ?? null,
  };
}

function normalizeGroupCueSummaryRow(row) {
  const items = normalizeCueList(row?.cue_data);

  return {
    id: String(row?.id || ""),
    groupId: String(row?.group_id || ""),
    title: String(row?.title || "").trim(),
    itemCount: items.length,
    durationSeconds: items.reduce((sum, item) => sum + Number(item.seconds || 0), 0),
    createdByName: String(row?.created_by_name || "").trim(),
    updatedByName: String(row?.updated_by_name || "").trim(),
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizeGroupCueRow(row) {
  return {
    ...normalizeGroupCueSummaryRow(row),
    items: normalizeCueList(row?.cue_data),
  };
}

function normalizeGroupMessageRow(row) {
  return {
    id: String(row?.id || ""),
    groupId: String(row?.group_id || ""),
    type: ["notice", "cue_request"].includes(row?.type) ? row.type : "notice",
    title: String(row?.title || "").trim(),
    body: String(row?.body || "").trim(),
    isRead: Boolean(row?.is_read),
    createdAt: row?.created_at ?? null,
  };
}

function throwHttpError(statusCode, errorCode, message) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;
  throw error;
}
