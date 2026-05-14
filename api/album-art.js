const { methodNotAllowed, sendJson } = require("./_lib/http");

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
const CUSTOM_ARTWORK_BY_TITLE = new Map([
  [
    "피너츠송",
    "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/e9/47/d7/e947d731-a19f-cef4-95d0-ecd4f4b0f418/cover_KAL000108_1.jpg/600x600bb.jpg",
  ],
  [
    "피너츠 송",
    "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/e9/47/d7/e947d731-a19f-cef4-95d0-ecd4f4b0f418/cover_KAL000108_1.jpg/600x600bb.jpg",
  ],
]);

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    methodNotAllowed(response, ["GET"]);
    return;
  }

  const title = String(request.query?.title || "").trim().slice(0, 80);

  if (!title) {
    sendJson(response, 400, {
      error: "missing_title",
      message: "title query parameter is required.",
    });
    return;
  }

  try {
    const artworkUrl = findCustomAlbumArtwork(title) || await findAlbumArtwork(title);

    sendJson(response, 200, {
      artworkUrl,
    });
  } catch (error) {
    console.error("album art lookup error", error);
    sendJson(response, 200, {
      artworkUrl: "",
    });
  }
};

async function findAlbumArtwork(title) {
  const url = new URL(ITUNES_SEARCH_URL);

  url.searchParams.set("term", title);
  url.searchParams.set("country", "KR");
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "5");

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 2500);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];
    const normalizedTitle = normalizeSearchText(title);
    const bestMatch = results.find((result) => normalizeSearchText(result.trackName) === normalizedTitle)
      || results[0];
    const artworkUrl = typeof bestMatch?.artworkUrl100 === "string" ? bestMatch.artworkUrl100 : "";

    return upscaleArtworkUrl(artworkUrl);
  } finally {
    clearTimeout(timeout);
  }
}

function upscaleArtworkUrl(url) {
  return String(url || "").replace(/\/\d+x\d+bb\.(jpg|jpeg|png|webp)$/i, "/600x600bb.$1");
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findCustomAlbumArtwork(title) {
  const normalizedTitle = normalizeSearchText(title).replaceAll(" ", "");

  for (const [customTitle, artworkUrl] of CUSTOM_ARTWORK_BY_TITLE) {
    if (normalizeSearchText(customTitle).replaceAll(" ", "") === normalizedTitle) {
      return artworkUrl;
    }
  }

  return "";
}
