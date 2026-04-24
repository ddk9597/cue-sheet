function sendJson(response, statusCode, payload) {
  response.status(statusCode);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.json(payload);
}

function methodNotAllowed(response, allowed) {
  response.setHeader("Allow", allowed.join(", "));
  sendJson(response, 405, {
    error: "method_not_allowed",
    message: `Only ${allowed.join(", ")} are supported.`,
  });
}

async function readJsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string") {
    return request.body ? JSON.parse(request.body) : {};
  }

  let rawBody = "";

  for await (const chunk of request) {
    rawBody += chunk;
  }

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

module.exports = {
  methodNotAllowed,
  readJsonBody,
  sendJson,
};
