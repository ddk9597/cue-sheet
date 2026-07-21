const { sendJson } = require("../http");

const albumArtHandler = require("./album-art");
const albumImageHandler = require("./album-image");
const audienceCuesHandler = require("./audience-cues");
const authHandler = require("./auth");
const communityHandler = require("./community");
const cuesHandler = require("./cues");
const groupsHandler = require("./groups");
const memberHandler = require("./member");
const performancesHandler = require("./performances");
const practiceHandler = require("./practice");
const recruitHandler = require("./recruit");
const todoAuthHandler = require("./todo-auth");
const todosHandler = require("./todos");

const ROUTES = new Map([
  ["album-art", albumArtHandler],
  ["album-image", albumImageHandler],
  ["audience-cues", audienceCuesHandler],
  ["auth", authHandler],
  ["community", communityHandler],
  ["cues", cuesHandler],
  ["groups", groupsHandler],
  ["member", memberHandler],
  ["performances", performancesHandler],
  ["practice", practiceHandler],
  ["recruit", recruitHandler],
  ["todo-auth", todoAuthHandler],
  ["todos", todosHandler],
]);

async function routeApiRequest(request, response) {
  const routeSegments = getApiRouteSegments(request);
  const routeName = routeSegments[0] || "";
  const handler = ROUTES.get(routeName);

  if (!handler) {
    sendJson(response, 404, {
      error: "api_route_not_found",
      message: "API 경로를 찾을 수 없습니다.",
    });
    return;
  }

  if (request.query && request.query.path === undefined) {
    request.query.path = routeSegments;
  }

  await handler(request, response);
}

function getApiRouteSegments(request) {
  const queryPath = request.query?.path ?? request.query?.["...path"];

  if (Array.isArray(queryPath)) {
    return queryPath.flatMap(splitRoutePath);
  }

  if (typeof queryPath === "string" && queryPath) {
    return splitRoutePath(queryPath);
  }

  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);

  return url.pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);
}

function splitRoutePath(value) {
  return String(value || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

module.exports = {
  routeApiRequest,
};
