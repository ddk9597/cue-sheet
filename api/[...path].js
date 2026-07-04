require("reflect-metadata");

const { Injectable, Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { routeApiRequest } = require("./_lib/routes/router");

let appContextPromise = null;

class ApiRouterService {
  async handle(request, response) {
    await routeApiRequest(request, response);
  }
}

Injectable()(ApiRouterService);

class AppModule {}

Module({
  providers: [ApiRouterService],
})(AppModule);

module.exports = async (request, response) => {
  const appContext = await getAppContext();
  const apiRouter = appContext.get(ApiRouterService);

  patchRequestQuery(request);
  patchResponseHelpers(response);

  return apiRouter.handle(request, response);
};

async function getAppContext() {
  if (!appContextPromise) {
    appContextPromise = NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
  }

  return appContextPromise;
}

function patchRequestQuery(request) {
  if (request.query && typeof request.query === "object") {
    return;
  }

  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  const query = {};

  for (const [key, value] of url.searchParams.entries()) {
    if (query[key] === undefined) {
      query[key] = value;
      continue;
    }

    query[key] = Array.isArray(query[key])
      ? [...query[key], value]
      : [query[key], value];
  }

  const pathSegments = url.pathname
    .replace(/^\/api\/?/, "")
    .split("/")
    .filter(Boolean);

  if (pathSegments.length && query.path === undefined) {
    query.path = pathSegments;
  }

  request.query = query;
}

function patchResponseHelpers(response) {
  if (typeof response.status !== "function") {
    response.status = (statusCode) => {
      response.statusCode = statusCode;
      return response;
    };
  }

  if (typeof response.json !== "function") {
    response.json = (payload) => {
      response.end(JSON.stringify(payload));
    };
  }

  if (typeof response.send !== "function") {
    response.send = (payload) => {
      response.end(payload);
    };
  }
}
