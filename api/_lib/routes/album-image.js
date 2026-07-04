const { methodNotAllowed, sendJson } = require("../http");

const ALLOWED_ARTWORK_HOST_PATTERN = /^is\d-ssl\.mzstatic\.com$/i;
const IMAGE_FETCH_TIMEOUT_MS = 5000;

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const artworkUrl = parseArtworkUrl(request.query?.url);

  if (!artworkUrl) {
    sendJson(response, 400, {
      error: "invalid_artwork_url",
      message: "A valid Apple Music artwork URL is required.",
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, IMAGE_FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(artworkUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!upstream.ok) {
      sendJson(response, 502, {
        error: "artwork_fetch_failed",
        message: "Album artwork could not be loaded.",
      });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    if (!contentType.toLowerCase().startsWith("image/")) {
      sendJson(response, 502, {
        error: "invalid_artwork_response",
        message: "Album artwork response was not an image.",
      });
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    response.status(200);
    response.setHeader("Cache-Control", "public, max-age=604800, immutable");
    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Length", String(buffer.length));
    response.send(buffer);
  } catch (error) {
    console.error("album image proxy error", error);
    sendJson(response, 502, {
      error: "artwork_proxy_failed",
      message: "Album artwork could not be loaded.",
    });
  } finally {
    clearTimeout(timeout);
  }
};

function parseArtworkUrl(value) {
  try {
    const url = new URL(String(value || ""));

    if (url.protocol !== "https:" || !ALLOWED_ARTWORK_HOST_PATTERN.test(url.hostname)) {
      return null;
    }

    if (!url.pathname.includes("/image/")) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}
