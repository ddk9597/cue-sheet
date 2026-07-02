const {
  getSessionUser,
  isValidEmail,
  normalizeEmail,
} = require("../_lib/auth");
const { ensureSchema, getSql } = require("../_lib/db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../_lib/http");

const MAX_GROUP_NAME_LENGTH = 80;
const MAX_MEMO_LENGTH = 5000;
const ROUTE_METHODS = {
  groups: ["GET", "POST"],
  invites: ["POST"],
  messages: ["GET"],
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

    if (route === "messages/accept") {
      const payload = await readJsonBody(request);

      await handleAcceptMessage(sql, response, sessionUser, payload);
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
    return queryPath.join("/");
  }

  if (typeof queryPath === "string" && queryPath) {
    return queryPath;
  }

  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);

  return url.pathname
    .replace(/^\/api\/member\/?/, "")
    .replace(/\/$/, "");
}

async function handleGetGroups(sql, response, sessionUser) {
  const rows = await sql.query(
    [
      "SELECT g.id, g.name, gm.role, g.created_at, g.updated_at",
      "FROM group_members gm",
      "JOIN groups g ON g.id = gm.group_id",
      "WHERE gm.user_id = $1",
      "ORDER BY g.updated_at DESC, g.created_at DESC",
    ].join(" "),
    [sessionUser.id],
  );

  sendJson(response, 200, {
    groups: rows.map(normalizeGroupRow),
  });
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
    const rows = await sql.query(
      [
        "INSERT INTO group_invites (group_id, inviter_user_id, invitee_user_id)",
        "VALUES ($1, $2, $3)",
        "RETURNING id, group_id, status, created_at",
      ].join(" "),
      [groupId, sessionUser.id, invitee.id],
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
  const rows = await sql.query(
    [
      "SELECT",
      "i.id, i.group_id, i.status, i.created_at, i.responded_at,",
      "g.name AS group_name,",
      "u.email AS inviter_email,",
      "u.name AS inviter_name",
      "FROM group_invites i",
      "JOIN groups g ON g.id = i.group_id",
      "JOIN app_users u ON u.id = i.inviter_user_id",
      "WHERE i.invitee_user_id = $1 AND i.status = 'pending'",
      "ORDER BY i.created_at DESC",
    ].join(" "),
    [sessionUser.id],
  );

  sendJson(response, 200, {
    messages: rows.map(normalizeInviteRow),
  });
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
        SET status = 'accepted', responded_at = NOW()
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
    throwHttpError(403, "invite_not_acceptable", "수락할 수 있는 초대가 아닙니다.");
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

function normalizePositiveId(value) {
  const id = String(value || "").trim();

  return /^\d+$/.test(id) ? id : "";
}

function normalizeGroupRow(row) {
  return {
    id: String(row?.id || ""),
    name: String(row?.name || ""),
    role: row?.role === "owner" ? "owner" : "member",
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizeInviteRow(row) {
  return {
    id: String(row?.id || ""),
    groupId: String(row?.group_id || ""),
    groupName: String(row?.group_name || ""),
    inviterEmail: normalizeEmail(row?.inviter_email),
    inviterName: String(row?.inviter_name || "").trim(),
    status: ["pending", "accepted", "rejected"].includes(row?.status) ? row.status : "pending",
    createdAt: row?.created_at ?? null,
    respondedAt: row?.responded_at ?? null,
  };
}

function throwHttpError(statusCode, errorCode, message) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;
  throw error;
}
