const { getSessionUser } = require("../auth");
const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const { resolveProfilePictureUrl } = require("../r2");

const CATEGORIES = new Set(["자유", "합주·친목", "공연·모임", "정보공유"]);
const MAX_POSTS = 100;
const MAX_POST_CONTENT_LENGTH = 3000;
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
    const segments = getCommunityRouteSegments(request);

    if (!segments.length) {
      if (request.method === "GET") {
        await handleListPosts(sql, response);
        return;
      }

      const sessionUser = await requireSessionUser(sql, request, "로그인 후 커뮤니티 글을 작성할 수 있습니다.");

      await handleCreatePost(sql, response, sessionUser, await readJsonBody(request));
      return;
    }

    if (segments.length === 2 && segments[1] === "comments") {
      const postId = normalizePositiveId(segments[0]);

      if (!postId) {
        throwHttpError(400, "invalid_community_post_id", "게시글을 확인해 주세요.");
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
      error: "community_route_not_found",
      message: "커뮤니티 API 경로를 찾을 수 없습니다.",
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
      console.error("community api error", error);
    }

    sendJson(response, statusCode, {
      error: error.errorCode || "community_api_failed",
      message: error.message || "커뮤니티 요청을 처리하지 못했습니다.",
    });
  }
};

async function handleListPosts(sql, response) {
  const rows = await sql.query([
    getPostSelectSql(),
    "ORDER BY community_posts.created_at DESC, community_posts.id DESC",
    "LIMIT $1",
  ].join(" "), [MAX_POSTS]);

  sendJson(response, 200, {
    posts: rows.map(normalizePostRow),
  });
}

async function handleCreatePost(sql, response, sessionUser, payload) {
  const category = normalizeText(payload?.category, 20);
  const title = normalizeText(payload?.title, 100);
  const content = normalizeText(payload?.content, MAX_POST_CONTENT_LENGTH);

  if (!CATEGORIES.has(category)) {
    throwHttpError(400, "invalid_community_category", "커뮤니티 분류를 선택해 주세요.");
  }

  if (!title) {
    throwHttpError(400, "invalid_community_title", "제목을 입력해 주세요.");
  }

  if (!content) {
    throwHttpError(400, "invalid_community_content", "내용을 입력해 주세요.");
  }

  const rows = await sql.query([
    "INSERT INTO community_posts (user_id, category, title, content)",
    "VALUES ($1, $2, $3, $4)",
    "RETURNING id",
  ].join(" "), [sessionUser.id, category, title, content]);
  const postRows = await sql.query([
    getPostSelectSql(),
    "WHERE community_posts.id = $1",
    "LIMIT 1",
  ].join(" "), [rows[0].id]);

  sendJson(response, 201, {
    post: normalizePostRow(postRows[0]),
  });
}

async function handleListComments(sql, response, postId) {
  await requireCommunityPost(sql, postId);
  const rows = await sql.query([
    getCommentSelectSql(),
    "WHERE community_comments.post_id = $1",
    "ORDER BY community_comments.created_at ASC, community_comments.id ASC",
  ].join(" "), [postId]);

  sendJson(response, 200, {
    comments: rows.map(normalizeCommentRow),
  });
}

async function handleCreateComment(sql, response, sessionUser, postId, payload) {
  await requireCommunityPost(sql, postId);
  const content = normalizeText(payload?.content, MAX_COMMENT_LENGTH);

  if (!content) {
    throwHttpError(400, "invalid_community_comment", "댓글 내용을 입력해 주세요.");
  }

  const rows = await sql.query([
    "INSERT INTO community_comments (post_id, user_id, content)",
    "VALUES ($1, $2, $3)",
    "RETURNING id",
  ].join(" "), [postId, sessionUser.id, content]);
  const commentRows = await sql.query([
    getCommentSelectSql(),
    "WHERE community_comments.id = $1",
    "LIMIT 1",
  ].join(" "), [rows[0].id]);

  sendJson(response, 201, {
    comment: normalizeCommentRow(commentRows[0]),
  });
}

async function requireSessionUser(sql, request, message) {
  const sessionUser = await getSessionUser(sql, request);

  if (!sessionUser) {
    throwHttpError(401, "not_authenticated", message);
  }

  return sessionUser;
}

async function requireCommunityPost(sql, postId) {
  const rows = await sql.query(
    "SELECT id FROM community_posts WHERE id = $1 LIMIT 1",
    [postId],
  );

  if (!rows[0]) {
    throwHttpError(404, "community_post_not_found", "커뮤니티 글을 찾을 수 없습니다.");
  }

  return rows[0];
}

function getPostSelectSql() {
  return [
    "SELECT community_posts.id, community_posts.category, community_posts.title,",
    "community_posts.content, community_posts.created_at,",
    "(SELECT COUNT(*)::int FROM community_comments WHERE community_comments.post_id = community_posts.id) AS comment_count,",
    "app_users.id AS author_user_id, app_users.email AS author_email,",
    "COALESCE(NULLIF(app_users.name, ''), 'Cue Sheet 멤버') AS author_name,",
    "app_users.picture_url AS author_picture_url, app_users.picture_key AS author_picture_key",
    "FROM community_posts",
    "JOIN app_users ON app_users.id = community_posts.user_id",
  ].join(" ");
}

function getCommentSelectSql() {
  return [
    "SELECT community_comments.id, community_comments.post_id, community_comments.content, community_comments.created_at,",
    "app_users.id AS author_user_id, app_users.email AS author_email,",
    "COALESCE(NULLIF(app_users.name, ''), 'Cue Sheet 멤버') AS author_name,",
    "app_users.picture_url AS author_picture_url, app_users.picture_key AS author_picture_key",
    "FROM community_comments",
    "JOIN app_users ON app_users.id = community_comments.user_id",
  ].join(" ");
}

function normalizePostRow(row) {
  return {
    id: String(row.id),
    category: row.category,
    title: row.title,
    content: row.content,
    commentCount: Number(row.comment_count || 0),
    authorUserId: String(row.author_user_id),
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

function getCommunityRouteSegments(request) {
  const queryPath = request.query?.path;
  const parts = Array.isArray(queryPath)
    ? queryPath
    : typeof queryPath === "string"
      ? queryPath.split("/")
      : new URL(request.url || "", `http://${request.headers.host || "localhost"}`)
        .pathname
        .replace(/^\/api\/community\/?/, "")
        .split("/");

  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part, index) => !(index === 0 && part === "community"));
}

function normalizePositiveId(value) {
  const normalized = String(value || "").trim();

  return /^[1-9]\d*$/.test(normalized) ? normalized : "";
}

function getPublicAuthorId(email, userId) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const localPart = normalizedEmail.includes("@") ? normalizedEmail.split("@")[0] : "";

  return localPart
    ? `@${localPart}`
    : `@member-${String(userId || "").trim() || "unknown"}`;
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
