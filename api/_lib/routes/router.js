const { sendJson } = require("../http");

const albumArtHandler = require("./album-art");
const albumImageHandler = require("./album-image");
const audienceCuesHandler = require("./audience-cues");
const authHandler = require("./auth");
const cuesHandler = require("./cues");
const memberHandler = require("./member");
const practiceHandler = require("./practice");
const todoAuthHandler = require("./todo-auth");
const todosHandler = require("./todos");

const ROUTES = new Map([
  ["album-art", albumArtHandler],
  ["album-image", albumImageHandler],
  ["audience-cues", audienceCuesHandler],
  ["auth", authHandler],
  ["cues", cuesHandler],
  ["member", memberHandler],
  ["practice", practiceHandler],
  ["todo-auth", todoAuthHandler],
  ["todos", todosHandler],
]);

async function routeApiRequest(request, response) {
  const routeName = getApiRouteName(request);
  const handler = ROUTES.get(routeName);

  if (!handler) {
    sendJson(response, 404, {
      error: "api_route_not_found",
      message: "API 경로를 찾을 수 없습니다.",
    });
    return;
  }

  await handler(request, response);
}

function getApiRouteName(request) {
  const queryPath = request.query?.path;

  if (Array.isArray(queryPath)) {
    return String(queryPath[0] || "").trim();
  }

  if (typeof queryPath === "string" && queryPath) {
    return queryPath.split("/")[0];
  }

  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);

  return url.pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean)[0] || "";
}

module.exports = {
  routeApiRequest,
};
