const { getSessionUser } = require("../auth");
const { ensureSchema, getSql } = require("../db");
const { methodNotAllowed, readJsonBody, sendJson } = require("../http");

const INTENTS = new Set(["구해요", "할래요"]);
const INSTRUMENTS = new Set(["일렉", "드럼", "기타", "베이스", "보컬", "신디"]);
const MAX_POSTS = 100;

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

    if (request.method === "GET") {
      await handleListPosts(sql, response);
      return;
    }

    const sessionUser = await getSessionUser(sql, request);

    if (!sessionUser) {
      sendJson(response, 401, {
        error: "not_authenticated",
        message: "로그인 후 게시글을 작성할 수 있습니다.",
      });
      return;
    }

    await handleCreatePost(sql, response, sessionUser, await readJsonBody(request));
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
    "SELECT recruit_posts.id, recruit_posts.intent, recruit_posts.instrument,",
    "recruit_posts.title, recruit_posts.region, recruit_posts.genre, recruit_posts.schedule,",
    "recruit_posts.content, recruit_posts.contact, recruit_posts.created_at,",
    "COALESCE(NULLIF(app_users.name, ''), 'Cue Sheet 멤버') AS author_name",
    "FROM recruit_posts",
    "JOIN app_users ON app_users.id = recruit_posts.user_id",
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
    "RETURNING id, intent, instrument, title, region, genre, schedule, content, contact, created_at",
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

  sendJson(response, 201, {
    post: normalizePostRow({
      ...rows[0],
      author_name: sessionUser.name || "Cue Sheet 멤버",
    }),
  });
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
    authorName: row.author_name,
    createdAt: row.created_at,
  };
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
