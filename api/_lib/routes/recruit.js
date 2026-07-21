const { getSessionUser } = require("../auth");
const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");
const { resolveProfilePictureUrl } = require("../r2");

const INTENTS = new Set(["구해요", "할래요"]);
const INSTRUMENTS = new Set(["일렉", "드럼", "기타", "베이스", "보컬", "신디"]);
const REGION_CATEGORIES = new Set([
  "서울",
  "경기",
  "인천",
  "강원",
  "대전·세종·충청",
  "광주·전라",
  "대구·경북",
  "부산·울산·경남",
  "제주",
  "전국·온라인",
]);
const MAX_POSTS = 100;
const MAX_COMMENT_LENGTH = 800;
const MAX_DIRECT_MESSAGE_LENGTH = 1000;

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

    if (segments.length === 2 && segments[1] === "message") {
      if (request.method !== "POST") {
        methodNotAllowed(response, ["POST"]);
        return;
      }

      const postId = normalizePositiveId(segments[0]);

      if (!postId) {
        throwHttpError(400, "invalid_recruit_post_id", "게시글을 확인해 주세요.");
      }

      const sessionUser = await requireSessionUser(sql, request, "로그인 후 쪽지를 보낼 수 있습니다.");

      await handleCreateDirectMessage(sql, response, sessionUser, postId, await readJsonBody(request));
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
  const instruments = normalizeInstrumentSelection(payload.instruments, payload.instrument);
  const instrument = instruments[0] || "";
  const regionCategory = normalizeRequestedRegionCategory(payload.regionCategory, payload.region);
  const title = normalizeText(payload.title, 100);
  const genre = normalizeText(payload.genre, 60);
  const schedule = normalizeText(payload.schedule, 80);
  const content = normalizeText(payload.content, 2000);
  const contact = normalizeText(payload.contact, 120);

  if (!INTENTS.has(intent)) {
    throwHttpError(400, "invalid_recruit_intent", "모집 유형을 선택해 주세요.");
  }

  if (!instruments.length) {
    throwHttpError(400, "invalid_recruit_instruments", "악기 파트를 하나 이상 선택해 주세요.");
  }

  if (!regionCategory) {
    throwHttpError(400, "invalid_recruit_region", "활동 지역을 선택해 주세요.");
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
    "(user_id, intent, instrument, instruments, region, region_category, title, genre, schedule, content, contact)",
    "VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10, $11)",
    "RETURNING id",
  ].join(" "), [
    sessionUser.id,
    intent,
    instrument,
    instruments,
    regionCategory,
    regionCategory,
    title,
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

  const content = normalizeText(payload?.content, MAX_COMMENT_LENGTH);

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

async function handleCreateDirectMessage(sql, response, sessionUser, postId, payload) {
  const post = await requireRecruitPost(sql, postId);
  const body = normalizeText(payload?.body, MAX_DIRECT_MESSAGE_LENGTH);

  if (!body) {
    throwHttpError(400, "invalid_direct_message", "쪽지 내용을 입력해 주세요.");
  }

  if (String(post.user_id) === String(sessionUser.id)) {
    throwHttpError(409, "cannot_message_self", "내 게시글에는 쪽지를 보낼 수 없습니다.");
  }

  const subject = normalizeText(`RE: ${post.title}`, 140);
  const rows = await sql.query([
    "INSERT INTO direct_messages",
    "(sender_user_id, recipient_user_id, recruit_post_id, subject, body)",
    "VALUES ($1, $2, $3, $4, $5)",
    "RETURNING id, created_at",
  ].join(" "), [sessionUser.id, post.user_id, postId, subject, body]);

  sendJson(response, 201, {
    message: {
      id: String(rows[0].id),
      createdAt: rows[0].created_at,
    },
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
    "SELECT id, user_id, title FROM recruit_posts WHERE id = $1 LIMIT 1",
    [postId],
  );

  if (!rows[0]) {
    throwHttpError(404, "recruit_post_not_found", "게시글을 찾을 수 없습니다.");
  }

  return rows[0];
}

function getPostSelectSql() {
  return [
    "SELECT recruit_posts.id, recruit_posts.intent, recruit_posts.instrument, recruit_posts.instruments,",
    "recruit_posts.title, recruit_posts.region, recruit_posts.region_category, recruit_posts.genre, recruit_posts.schedule,",
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
  const instruments = normalizeStoredInstruments(row.instruments, row.instrument);
  const regionCategory = normalizeStoredRegionCategory(row.region_category, row.region);

  return {
    id: String(row.id),
    intent: row.intent,
    instrument: instruments[0] || row.instrument,
    instruments,
    title: row.title,
    region: regionCategory,
    regionCategory,
    genre: row.genre,
    schedule: row.schedule,
    content: row.content,
    contact: row.contact,
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

function normalizeInstrumentSelection(value, legacyValue = "") {
  const rawValues = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? [legacyValue]
      : [value];
  const normalizedValues = rawValues
    .map((instrument) => normalizeText(instrument, 20))
    .filter(Boolean);

  if (
    !normalizedValues.length
    || normalizedValues.length > INSTRUMENTS.size
    || normalizedValues.some((instrument) => !INSTRUMENTS.has(instrument))
  ) {
    return [];
  }

  return [...new Set(normalizedValues)];
}

function normalizeStoredInstruments(value, legacyValue = "") {
  const values = Array.isArray(value) && value.length ? value : [legacyValue];

  return [...new Set(values
    .map((instrument) => normalizeText(instrument, 20))
    .filter((instrument) => INSTRUMENTS.has(instrument)))];
}

function normalizeRequestedRegionCategory(value, legacyValue = "") {
  const requestedValue = normalizeText(value, 40);

  if (requestedValue) {
    return REGION_CATEGORIES.has(requestedValue) ? requestedValue : "";
  }

  return inferLegacyRegionCategory(legacyValue);
}

function normalizeStoredRegionCategory(value, legacyValue = "") {
  const regionCategory = normalizeText(value, 40);

  return REGION_CATEGORIES.has(regionCategory)
    ? regionCategory
    : inferLegacyRegionCategory(legacyValue);
}

function inferLegacyRegionCategory(value) {
  const region = normalizeText(value, 80);

  if (!region) return "전국·온라인";
  if (region.includes("서울")) return "서울";
  if (["경기", "수원", "성남", "고양"].some((keyword) => region.includes(keyword))) return "경기";
  if (region.includes("인천")) return "인천";
  if (region.includes("강원")) return "강원";
  if (["대전", "세종", "충청", "충북", "충남"].some((keyword) => region.includes(keyword))) return "대전·세종·충청";
  if (["광주", "전라", "전북", "전남"].some((keyword) => region.includes(keyword))) return "광주·전라";
  if (["대구", "경북"].some((keyword) => region.includes(keyword))) return "대구·경북";
  if (["부산", "울산", "경남"].some((keyword) => region.includes(keyword))) return "부산·울산·경남";
  if (region.includes("제주")) return "제주";
  return "전국·온라인";
}

function throwHttpError(statusCode, errorCode, message) {
  const error = new Error(message);

  error.statusCode = statusCode;
  error.errorCode = errorCode;
  throw error;
}
