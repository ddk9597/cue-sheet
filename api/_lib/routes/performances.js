const { getSessionUser } = require("../auth");
const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");

const MAX_TITLE_LENGTH = 120;
const MAX_LOCATION_LENGTH = 120;
const MAX_MEMO_LENGTH = 1000;

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

    const segments = getPerformanceRouteSegments(request);

    if (segments.length === 1 && segments[0] === "create") {
      if (request.method !== "POST") {
        methodNotAllowed(response, ["POST"]);
        return;
      }

      await handleCreatePerformance(sql, response, sessionUser, await readJsonBody(request));
      return;
    }

    if (segments.length === 2 && segments[0] === "group") {
      if (request.method !== "GET") {
        methodNotAllowed(response, ["GET"]);
        return;
      }

      const groupId = normalizePositiveId(segments[1]);

      if (!groupId) {
        throwHttpError(400, "invalid_group_id", "그룹을 확인해 주세요.");
      }

      await handleListGroupPerformances(sql, response, sessionUser, groupId);
      return;
    }

    const performanceId = normalizePositiveId(segments[0]);

    if (!performanceId) {
      sendJson(response, 404, {
        error: "performance_route_not_found",
        message: "공연 API 경로를 찾을 수 없습니다.",
      });
      return;
    }

    if (segments.length === 1) {
      if (request.method === "GET") {
        await handleGetPerformance(sql, response, sessionUser, performanceId);
        return;
      }

      if (request.method === "PUT") {
        await handleUpdatePerformance(sql, response, sessionUser, performanceId, await readJsonBody(request));
        return;
      }

      if (request.method === "DELETE") {
        await handleDeletePerformance(sql, response, sessionUser, performanceId);
        return;
      }

      methodNotAllowed(response, ["GET", "PUT", "DELETE"]);
      return;
    }

    if (segments.length === 2 && segments[1] === "cues") {
      if (request.method === "GET") {
        await handleListPerformanceCues(sql, response, sessionUser, performanceId);
        return;
      }

      if (request.method === "POST") {
        await handleAttachPerformanceCue(sql, response, sessionUser, performanceId, await readJsonBody(request));
        return;
      }

      methodNotAllowed(response, ["GET", "POST"]);
      return;
    }

    sendJson(response, 404, {
      error: "performance_route_not_found",
      message: "공연 API 경로를 찾을 수 없습니다.",
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
      console.error("performances api error", error);
    }

    sendJson(response, statusCode, {
      error: error.errorCode || "performances_api_failed",
      message: error.message || "공연 요청을 처리하지 못했습니다.",
    });
  }
};

function getPerformanceRouteSegments(request) {
  const queryPath = request.query?.path;
  const parts = Array.isArray(queryPath)
    ? queryPath
    : typeof queryPath === "string"
      ? queryPath.split("/")
      : new URL(request.url || "", `http://${request.headers.host || "localhost"}`)
        .pathname
        .replace(/^\/api\/performances\/?/, "")
        .split("/");

  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part, index) => !(index === 0 && part === "performances"));
}

async function handleCreatePerformance(sql, response, sessionUser, payload) {
  const groupId = normalizePositiveId(payload.groupId);
  const title = normalizeText(payload.title, MAX_TITLE_LENGTH);
  const performanceDate = normalizeDateText(payload.performanceDate);
  const location = normalizeText(payload.location, MAX_LOCATION_LENGTH);
  const memo = normalizeText(payload.memo, MAX_MEMO_LENGTH);

  if (!groupId) {
    throwHttpError(400, "invalid_group_id", "공연을 연결할 그룹을 선택해 주세요.");
  }

  if (!title) {
    throwHttpError(400, "invalid_performance_title", "공연명을 입력해 주세요.");
  }

  const access = await requireGroupAccess(sql, sessionUser, groupId);

  if (access.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 공연을 추가할 수 있습니다.");
  }

  const rows = await sql.query(
    [
      "INSERT INTO performances (group_id, title, performance_date, location, memo, created_by, updated_at)",
      "VALUES ($1, $2, $3, $4, $5, $6, NOW())",
      "RETURNING id, group_id, title, performance_date, location, memo, created_at, updated_at",
    ].join(" "),
    [groupId, title, performanceDate, location, memo, sessionUser.id],
  );

  await touchGroup(sql, groupId);

  sendJson(response, 201, {
    performance: normalizePerformanceRow(rows[0]),
  });
}

async function handleListGroupPerformances(sql, response, sessionUser, groupId) {
  await requireGroupAccess(sql, sessionUser, groupId);

  const rows = await sql.query(
    [
      "SELECT id, group_id, title, performance_date, location, memo, created_at, updated_at",
      "FROM performances",
      "WHERE group_id = $1",
      "ORDER BY performance_date ASC, updated_at DESC",
    ].join(" "),
    [groupId],
  );

  sendJson(response, 200, {
    performances: rows.map(normalizePerformanceRow),
  });
}

async function handleGetPerformance(sql, response, sessionUser, performanceId) {
  const performance = await requirePerformanceAccess(sql, sessionUser, performanceId);

  sendJson(response, 200, {
    performance: normalizePerformanceRow(performance),
  });
}

async function handleUpdatePerformance(sql, response, sessionUser, performanceId, payload) {
  const performance = await requirePerformanceAccess(sql, sessionUser, performanceId);

  if (performance.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 공연을 수정할 수 있습니다.");
  }

  const title = normalizeText(payload.title, MAX_TITLE_LENGTH);
  const performanceDate = normalizeDateText(payload.performanceDate);
  const location = normalizeText(payload.location, MAX_LOCATION_LENGTH);
  const memo = normalizeText(payload.memo, MAX_MEMO_LENGTH);

  if (!title) {
    throwHttpError(400, "invalid_performance_title", "공연명을 입력해 주세요.");
  }

  const rows = await sql.query(
    [
      "UPDATE performances",
      "SET title = $2, performance_date = $3, location = $4, memo = $5, updated_at = NOW()",
      "WHERE id = $1",
      "RETURNING id, group_id, title, performance_date, location, memo, created_at, updated_at",
    ].join(" "),
    [performanceId, title, performanceDate, location, memo],
  );

  await touchGroup(sql, performance.group_id);

  sendJson(response, 200, {
    performance: normalizePerformanceRow(rows[0]),
  });
}

async function handleDeletePerformance(sql, response, sessionUser, performanceId) {
  const performance = await requirePerformanceAccess(sql, sessionUser, performanceId);

  if (performance.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 공연을 삭제할 수 있습니다.");
  }

  const rows = await sql.query(
    "DELETE FROM performances WHERE id = $1 RETURNING id",
    [performanceId],
  );

  if (!rows[0]) {
    throwHttpError(404, "performance_not_found", "공연을 찾을 수 없습니다.");
  }

  await touchGroup(sql, performance.group_id);

  sendJson(response, 200, {
    ok: true,
  });
}

async function handleListPerformanceCues(sql, response, sessionUser, performanceId) {
  await requirePerformanceAccess(sql, sessionUser, performanceId);

  const rows = await sql.query(
    [
      "SELECT pc.id, pc.performance_id, pc.group_cue_id, pc.sort_order, pc.created_at, gc.title",
      "FROM performance_cues pc",
      "JOIN group_cues gc ON gc.id = pc.group_cue_id",
      "WHERE pc.performance_id = $1",
      "ORDER BY pc.sort_order ASC, pc.id ASC",
    ].join(" "),
    [performanceId],
  );

  sendJson(response, 200, {
    cues: rows.map(normalizePerformanceCueRow),
  });
}

async function handleAttachPerformanceCue(sql, response, sessionUser, performanceId, payload) {
  const performance = await requirePerformanceAccess(sql, sessionUser, performanceId);

  if (performance.role !== "owner") {
    throwHttpError(403, "not_group_owner", "그룹 owner만 공연 큐시트를 연결할 수 있습니다.");
  }

  const groupCueId = normalizePositiveId(payload.groupCueId);
  const sortOrder = Math.max(0, Number.parseInt(payload.sortOrder, 10) || 0);

  if (!groupCueId) {
    throwHttpError(400, "invalid_group_cue_id", "공연에 연결할 그룹 큐시트를 선택해 주세요.");
  }

  const cueRows = await sql.query(
    "SELECT id FROM group_cues WHERE id = $1 AND group_id = $2 LIMIT 1",
    [groupCueId, performance.group_id],
  );

  if (!cueRows[0]) {
    throwHttpError(404, "group_cue_not_found", "그룹 큐시트를 찾을 수 없습니다.");
  }

  const rows = await sql.query(
    [
      "INSERT INTO performance_cues (performance_id, group_cue_id, sort_order)",
      "VALUES ($1, $2, $3)",
      "ON CONFLICT (performance_id, group_cue_id)",
      "DO UPDATE SET sort_order = EXCLUDED.sort_order",
      "RETURNING id, performance_id, group_cue_id, sort_order, created_at",
    ].join(" "),
    [performanceId, groupCueId, sortOrder],
  );

  sendJson(response, 201, {
    cue: normalizePerformanceCueRow(rows[0]),
  });
}

async function requirePerformanceAccess(sql, sessionUser, performanceId) {
  const rows = await sql.query(
    [
      "SELECT p.id, p.group_id, p.title, p.performance_date, p.location, p.memo, p.created_at, p.updated_at, gm.role",
      "FROM performances p",
      "JOIN group_members gm ON gm.group_id = p.group_id",
      "WHERE p.id = $1 AND gm.user_id = $2",
      "LIMIT 1",
    ].join(" "),
    [performanceId, sessionUser.id],
  );

  if (!rows[0]) {
    const existingRows = await sql.query(
      "SELECT 1 FROM performances WHERE id = $1 LIMIT 1",
      [performanceId],
    );

    throwHttpError(
      existingRows[0] ? 403 : 404,
      existingRows[0] ? "not_group_member" : "performance_not_found",
      existingRows[0] ? "그룹 멤버만 접근할 수 있습니다." : "공연을 찾을 수 없습니다.",
    );
  }

  return rows[0];
}

async function requireGroupAccess(sql, sessionUser, groupId) {
  const rows = await sql.query(
    [
      "SELECT g.id, gm.role",
      "FROM groups g",
      "JOIN group_members gm ON gm.group_id = g.id",
      "WHERE g.id = $1 AND gm.user_id = $2",
      "LIMIT 1",
    ].join(" "),
    [groupId, sessionUser.id],
  );

  if (!rows[0]) {
    const existingRows = await sql.query(
      "SELECT 1 FROM groups WHERE id = $1 LIMIT 1",
      [groupId],
    );

    throwHttpError(
      existingRows[0] ? 403 : 404,
      existingRows[0] ? "not_group_member" : "group_not_found",
      existingRows[0] ? "그룹 멤버만 접근할 수 있습니다." : "그룹을 찾을 수 없습니다.",
    );
  }

  return {
    role: rows[0].role === "owner" ? "owner" : "member",
  };
}

async function touchGroup(sql, groupId) {
  await sql.query(
    "UPDATE groups SET updated_at = NOW() WHERE id = $1",
    [groupId],
  );
}

function normalizePerformanceRow(row) {
  return {
    id: String(row?.id || ""),
    groupId: String(row?.group_id || ""),
    title: String(row?.title || "").trim(),
    performanceDate: String(row?.performance_date || "").trim(),
    location: String(row?.location || "").trim(),
    memo: String(row?.memo || "").trim(),
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizePerformanceCueRow(row) {
  return {
    id: String(row?.id || ""),
    performanceId: String(row?.performance_id || ""),
    groupCueId: String(row?.group_cue_id || ""),
    title: String(row?.title || "").trim(),
    sortOrder: Number(row?.sort_order || 0),
    createdAt: row?.created_at ?? null,
  };
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeDateText(value) {
  const text = String(value || "").trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizePositiveId(value) {
  const id = String(value || "").trim();

  return /^\d+$/.test(id) ? id : "";
}

function throwHttpError(statusCode, errorCode, message) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;
  throw error;
}
