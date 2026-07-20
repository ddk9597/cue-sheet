const { getSessionUser } = require("../auth");
const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const { resolveProfilePictureUrl } = require("../r2");

const INTENTS = new Set(["구해요", "할래요"]);
const INSTRUMENTS = new Set(["일렉", "드럼", "기타", "베이스", "보컬", "신디"]);
const MAX_POSTS = 100;
const MAX_COMMENT_LENGTH = 800;

module.exports = async (request, response) => {
  if (!["GET", "POST"].includes(request.method)) {
    methodNotAllowed(response, ["GET", "POST"]);
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
    const segments = getRecruitRouteSegments(request);

    if (!segments.length) {
      if (request.method === "GET") {
        await handleListPosts(sql, response);
        return;
      }

      const sessionUser = await requireSessionUser(sql, request);

      await handleCreatePost(sql, response, sessionUser, await readJsonBody(request));
      return;
    }

    if (segments.length === 2 && segments[1] === "comments") {
      const postId = normalizePositiveId(segments[0]);

      if (!postId) {
        throwHttpError(400, "invalid_recruit_post_id", "게시글을 확인해 주세요.");
      }

      if (request.method === "GET") {
        await handleListComments(sql, response, postId);
        return;
      }

      const sessionUser = await requireSessionUser(sql, request, "로그인 후 댓글을 작성할 수 있습니다.");

      await handleCreateComment(sql, response, sessionUser, postId, await readJsonBody(request));
      return;
    }

    sendJson(response, 404, {
      error: "recruit_route_not_found",
      message: "게시판 API 경로를 찾을 수 없습니다.",
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
      console.error("recruit api error", error);
    }

    sendJson(response, statusCode, {
      error: error.errorCode || "recruit_api_failed",
      message: error.message || "게시판 요청을 처리하지 못했습니다.",
    });
  }
};

async function handleListPosts(sql, response) {
  const rows = await sql.query([
    getPostSelectSql(),
    "ORDER BY recruit_posts.created_at DESC, recruit_posts.id DESC",
    "LIMIT $1",
  ].join(" "), [MAX_POSTS]);

  sendJson(response, 200, {
    posts: rows.map(normalizePostRow),
  });
}

async function handleCreatePost(sql, response, sessionUser, payload) {
  const intent = normalizeText(payload.intent, 10);
  const instrument = normalizeText(payload.instrument, 20);
  const title = normalizeText(payload.title, 100);
  const region = normalizeText(payload.region, 40);
  const genre = normalizeText(payload.genre, 60);
  const schedule = normalizeText(payload.schedule, 80);
  const content = normalizeText(payload.content, 2000);
  const contact = normalizeText(payload.contact, 120);

  if (!INTENTS.has(intent)) {
    throwHttpError(400, "invalid_recruit_intent", "모집 유형을 선택해 주세요.");
  }

  if (!INSTRUMENTS.has(instrument)) {
    throwHttpError(400, "invalid_recruit_instrument", "악기 파트를 선택해 주세요.");
  }

  if (!title) {
    throwHttpError(400, "invalid_recruit_title", "제목을 입력해 주세요.");
  }

  if (!content) {
    throwHttpError(400, "invalid_recruit_content", "활동 내용을 입력해 주세요.");
  }

  if (!contact) {
    throwHttpError(400, "invalid_recruit_contact", "연락 방법을 입력해 주세요.");
  }

  const rows = await sql.query([
    "INSERT INTO recruit_posts",
    "(user_id, intent, instrument, title, region, genre, schedule, content, contact)",
    "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    "RETURNING id",
  ].join(" "), [
    sessionUser.id,
    intent,
    instrument,
    title,
    region,
    genre,
    schedule,
    content,
    contact,
  ]);

  const postRows = await sql.query([
    getPostSelectSql(),
    "WHERE recruit_posts.id = $1",
    "LIMIT 1",
  ].join(" "), [rows[0].id]);

  sendJson(response, 201, {
    post: normalizePostRow(postRows[0]),
  });
}

async function handleListComments(sql, response, postId) {
  await requireRecruitPost(sql, postId);

  const rows = await sql.query([
    getCommentSelectSql(),
    "WHERE recruit_comments.post_id = $1",
    "ORDER BY recruit_comments.created_at ASC, recruit_comments.id ASC",
  ].join(" "), [postId]);

  sendJson(response, 200, {
    comments: rows.map(normalizeCommentRow),
  });
}

async function handleCreateComment(sql, response, sessionUser, postId, payload) {
  await requireRecruitPost(sql, postId);

  const content = normalizeText(payload.content, MAX_COMMENT_LENGTH);

  if (!content) {
    throwHttpError(400, "invalid_recruit_comment", "댓글 내용을 입력해 주세요.");
  }

  const rows = await sql.query([
    "INSERT INTO recruit_comments (post_id, user_id, content)",
    "VALUES ($1, $2, $3)",
    "RETURNING id",
  ].join(" "), [postId, sessionUser.id, content]);
  const commentRows = await sql.query([
    getCommentSelectSql(),
    "WHERE recruit_comments.id = $1",
    "LIMIT 1",
  ].join(" "), [rows[0].id]);

  sendJson(response, 201, {
    comment: normalizeCommentRow(commentRows[0]),
  });
}

async function requireSessionUser(sql, request, message = "로그인 후 게시글을 작성할 수 있습니다.") {
  const sessionUser = await getSessionUser(sql, request);

  if (!sessionUser) {
    throwHttpError(401, "not_authenticated", message);
  }

  return sessionUser;
}

async function requireRecruitPost(sql, postId) {
  const rows = await sql.query(
    "SELECT id FROM recruit_posts WHERE id = $1 LIMIT 1",
    [postId],
  );

  if (!rows[0]) {
    throwHttpError(404, "recruit_post_not_found", "게시글을 찾을 수 없습니다.");
  }
}

function getPostSelectSql() {
  return [
    "SELECT recruit_posts.id, recruit_posts.intent, recruit_posts.instrument,",
    "recruit_posts.title, recruit_posts.region, recruit_posts.genre, recruit_posts.schedule,",
    "recruit_posts.content, recruit_posts.contact, recruit_posts.created_at,",
    "(SELECT COUNT(*)::int FROM recruit_comments WHERE recruit_comments.post_id = recruit_posts.id) AS comment_count,",
    "app_users.id AS author_user_id, app_users.email AS author_email,",
    "COALESCE(NULLIF(app_users.name, ''), 'Cue Sheet 멤버') AS author_name,",
    "app_users.picture_url AS author_picture_url, app_users.picture_key AS author_picture_key",
    "FROM recruit_posts",
    "JOIN app_users ON app_users.id = recruit_posts.user_id",
  ].join(" ");
}

function getCommentSelectSql() {
  return [
    "SELECT recruit_comments.id, recruit_comments.post_id, recruit_comments.content, recruit_comments.created_at,",
    "app_users.id AS author_user_id, app_users.email AS author_email,",
    "COALESCE(NULLIF(app_users.name, ''), 'Cue Sheet 멤버') AS author_name,",
    "app_users.picture_url AS author_picture_url, app_users.picture_key AS author_picture_key",
    "FROM recruit_comments",
    "JOIN app_users ON app_users.id = recruit_comments.user_id",
  ].join(" ");
}

function normalizePostRow(row) {
  return {
    id: String(row.id),
    intent: row.intent,
    instrument: row.instrument,
    title: row.title,
    region: row.region,
    genre: row.genre,
    schedule: row.schedule,
    content: row.content,
    contact: row.contact,
    commentCount: Number(row.comment_count || 0),
    authorName: row.author_name,
    authorId: getPublicAuthorId(row.author_email, row.author_user_id),
    authorPictureUrl: resolveProfilePictureUrl({
      picture_key: row.author_picture_key,
      picture_url: row.author_picture_url,
    }),
    createdAt: row.created_at,
  };
}

function normalizeCommentRow(row) {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    content: row.content,
    authorName: row.author_name,
    authorId: getPublicAuthorId(row.author_email, row.author_user_id),
    authorPictureUrl: resolveProfilePictureUrl({
      picture_key: row.author_picture_key,
      picture_url: row.author_picture_url,
    }),
    createdAt: row.created_at,
  };
}

function getRecruitRouteSegments(request) {
  const queryPath = request.query?.path;
  const parts = Array.isArray(queryPath)
    ? queryPath
    : typeof queryPath === "string"
      ? queryPath.split("/")
      : new URL(request.url || "", `http://${request.headers.host || "localhost"}`)
        .pathname
        .replace(/^\/api\/recruit\/?/, "")
        .split("/");

  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part, index) => !(index === 0 && part === "recruit"));
}

function normalizePositiveId(value) {
  const normalized = String(value || "").trim();

  return /^[1-9]\d*$/.test(normalized) ? normalized : "";
}

function getPublicAuthorId(email, userId) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const localPart = normalizedEmail.includes("@") ? normalizedEmail.split("@")[0] : "";

  if (localPart) {
    return `@${localPart}`;
  }

  return `@member-${String(userId || "").trim() || "unknown"}`;
}

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function throwHttpError(statusCode, errorCode, message) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;
  throw error;
}
