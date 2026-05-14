const AUDIENCE_CUES_ENDPOINT = "/api/audience-cues";
const ALBUM_ART_ENDPOINT = "/api/album-art";
const ALBUM_CACHE_KEY = "cue-sheet-audience-albums";
const ALBUM_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 30000;
const CUE_TYPE_SONG = "song";
const CUE_TYPE_INTERMISSION = "intermission";

const refreshButton = document.querySelector("#refreshButton");
const liveStatus = document.querySelector("#liveStatus");
const cueCount = document.querySelector("#cueCount");
const emptyState = document.querySelector("#emptyState");
const cueList = document.querySelector("#cueList");
const cueCardTemplate = document.querySelector("#cueCardTemplate");

let refreshTimer = null;
let albumArtworkCache = readAlbumArtworkCache();

refreshButton?.addEventListener("click", () => {
  loadAudienceCues({ manual: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
    return;
  }

  loadAudienceCues();
  startAutoRefresh();
});

bootstrap();

function bootstrap() {
  document.body.classList.add("is-loading");
  loadAudienceCues();
  startAutoRefresh();
}

function startAutoRefresh() {
  if (refreshTimer) {
    return;
  }

  refreshTimer = window.setInterval(() => {
    loadAudienceCues();
  }, REFRESH_INTERVAL_MS);
}

async function loadAudienceCues({ manual = false } = {}) {
  if (manual) {
    liveStatus.textContent = "최신 큐시트를 확인하는 중입니다.";
  }

  refreshButton.disabled = true;

  try {
    const response = await fetch(AUDIENCE_CUES_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      throw new Error(payload.message || "큐시트를 불러오지 못했습니다.");
    }

    renderAudienceCues(normalizeCueCollection(payload.items));
  } catch (error) {
    renderError(error.message);
  } finally {
    document.body.classList.remove("is-loading");
    refreshButton.disabled = false;
  }
}

function renderAudienceCues(cues) {
  const songs = cues.filter((cue) => cue.type !== CUE_TYPE_INTERMISSION);

  cueList.replaceChildren();
  cueCount.textContent = songs.length ? `${songs.length}곡` : "0곡";
  emptyState.hidden = songs.length > 0;

  let partNumber = 1;
  let songNumber = 0;
  let shouldRenderPartHeading = true;

  for (const cue of cues) {
    if (cue.type === CUE_TYPE_INTERMISSION) {
      appendAudienceIntermission(cue);
      partNumber += 1;
      shouldRenderPartHeading = true;
      continue;
    }

    if (shouldRenderPartHeading) {
      appendAudiencePartHeading(partNumber);
      shouldRenderPartHeading = false;
    }

    songNumber += 1;
    const item = cueCardTemplate.content.firstElementChild.cloneNode(true);
    const number = item.querySelector(".cue-number");
    const title = item.querySelector(".cue-title");

    number.textContent = String(songNumber).padStart(2, "0");
    title.textContent = cue.title;

    cueList.appendChild(item);
    hydrateAlbumArtwork(item, cue);
  }

  liveStatus.classList.remove("is-error");
  liveStatus.textContent = songs.length
    ? "공개된 최신 공연 순서입니다."
    : "공개된 큐시트가 없습니다.";
}

function appendAudiencePartHeading(partNumber) {
  const item = document.createElement("li");

  item.className = "audience-part-heading";
  item.textContent = `${partNumber}부`;
  cueList.appendChild(item);
}

function appendAudienceIntermission(cue) {
  const item = document.createElement("li");

  item.className = "audience-intermission";
  item.textContent = cue.title || "인터미션";
  cueList.appendChild(item);
}

function renderError(message) {
  liveStatus.classList.add("is-error");
  liveStatus.textContent = message || "큐시트를 불러오지 못했습니다.";
}

function hydrateAlbumArtwork(item, cue) {
  const cacheKey = getAlbumCacheKey(cue.title);

  if (!cacheKey) {
    return;
  }

  const cached = albumArtworkCache[cacheKey];

  if (cached && Date.now() - cached.cachedAt < ALBUM_CACHE_MAX_AGE_MS) {
    if (cached.url) {
      applyAlbumArtwork(item, cached.url);
    }
    return;
  }

  fetchAlbumArtwork(cue.title)
    .then((url) => {
      albumArtworkCache = {
        ...albumArtworkCache,
        [cacheKey]: {
          cachedAt: Date.now(),
          url: url || "",
        },
      };
      writeAlbumArtworkCache(albumArtworkCache);

      if (url && item.isConnected) {
        applyAlbumArtwork(item, url);
      }
    })
    .catch(() => {
      albumArtworkCache = {
        ...albumArtworkCache,
        [cacheKey]: {
          cachedAt: Date.now(),
          url: "",
        },
      };
      writeAlbumArtworkCache(albumArtworkCache);
    });
}

async function fetchAlbumArtwork(title) {
  const url = new URL(ALBUM_ART_ENDPOINT, window.location.origin);

  url.searchParams.set("title", title);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return "";
  }

  const payload = await safeReadJson(response);
  const artworkUrl = typeof payload.artworkUrl === "string" ? payload.artworkUrl : "";

  return artworkUrl;
}

function applyAlbumArtwork(item, url) {
  item.style.backgroundImage = `url("${escapeCssUrl(url)}")`;
  item.classList.add("has-album-art");
}

function getAlbumCacheKey(title) {
  return normalizeSearchText(title);
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function readAlbumArtworkCache() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ALBUM_CACHE_KEY) || "{}");

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAlbumArtworkCache(value) {
  try {
    window.localStorage.setItem(ALBUM_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Artwork lookup is optional; the setlist stays usable without localStorage.
  }
}

function escapeCssUrl(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}

function normalizeCueCollection(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => normalizeCueRecord(item, index))
    .filter(Boolean);
}

function normalizeCueRecord(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const type = item.type === CUE_TYPE_INTERMISSION ? CUE_TYPE_INTERMISSION : CUE_TYPE_SONG;
  const title = typeof item.title === "string" ? item.title.trim() : "";

  if (type === CUE_TYPE_INTERMISSION) {
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `cue-${index + 1}`,
      type,
      title: title.slice(0, 60) || "인터미션",
      bpm: "",
      seconds: 0,
    };
  }

  const seconds = Number(item.seconds);

  if (!title || !Number.isInteger(seconds) || seconds < 0) {
    return null;
  }

  return {
    id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : `cue-${index + 1}`,
    type,
    title: title.slice(0, 60),
    bpm: normalizeBpm(item.bpm),
    seconds,
  };
}

function normalizeBpm(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\D/g, "").slice(0, 3);
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
