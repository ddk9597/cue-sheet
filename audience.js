const AUDIENCE_CUES_ENDPOINT = "/api/audience-cues";
const ALBUM_ART_ENDPOINT = "/api/album-art";
const ALBUM_IMAGE_PROXY_ENDPOINT = "/api/album-image";
const ALBUM_CACHE_KEY = "cue-sheet-audience-albums";
const ALBUM_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 30000;
const SAVE_IMAGE_FILENAME = "cue-sheet-live.png";
const EXPORT_FONT_FAMILY = "\"Pretendard\", \"Apple SD Gothic Neo\", \"Noto Sans KR\", sans-serif";
const CUE_TYPE_SONG = "song";
const CUE_TYPE_INTERMISSION = "intermission";
const CUSTOM_ALBUM_ARTWORK_BY_TITLE = new Map([
  [
    "피너츠송",
    "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/e9/47/d7/e947d731-a19f-cef4-95d0-ecd4f4b0f418/cover_KAL000108_1.jpg/600x600bb.jpg",
  ],
  [
    "피너츠 송",
    "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/e9/47/d7/e947d731-a19f-cef4-95d0-ecd4f4b0f418/cover_KAL000108_1.jpg/600x600bb.jpg",
  ],
]);

const refreshButton = document.querySelector("#refreshButton");
const liveStatus = document.querySelector("#liveStatus");
const cueCount = document.querySelector("#cueCount");
const emptyState = document.querySelector("#emptyState");
const cueList = document.querySelector("#cueList");
const cueCardTemplate = document.querySelector("#cueCardTemplate");
const saveImageButton = document.querySelector("#saveImageButton");

let refreshTimer = null;
let albumArtworkCache = readAlbumArtworkCache();
let renderedCues = [];
let saveImageInFlight = false;

refreshButton?.addEventListener("click", () => {
  loadAudienceCues({ manual: true });
});

saveImageButton?.addEventListener("click", () => {
  saveAudienceImage();
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
  renderedCues = cues;

  const songs = cues.filter(isAudienceSong);

  cueList.replaceChildren();
  cueCount.textContent = songs.length ? `${songs.length}곡` : "0곡";
  emptyState.hidden = songs.length > 0;
  if (saveImageButton) {
    saveImageButton.disabled = songs.length === 0;
  }

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

async function saveAudienceImage() {
  if (saveImageInFlight) {
    return;
  }

  const songs = renderedCues.filter(isAudienceSong);

  if (!songs.length) {
    return;
  }

  saveImageInFlight = true;
  const defaultButtonText = saveImageButton.textContent;

  saveImageButton.disabled = true;
  saveImageButton.classList.add("is-saving");
  saveImageButton.textContent = "생성 중";
  liveStatus.classList.remove("is-error");
  liveStatus.textContent = "저장용 이미지를 만드는 중입니다.";

  try {
    const blob = await createAudienceImageBlob(renderedCues);
    const file = typeof File === "function"
      ? new File([blob], SAVE_IMAGE_FILENAME, { type: "image/png" })
      : null;
    const didShare = await shareImageFile(file);

    if (!didShare) {
      downloadBlob(blob, SAVE_IMAGE_FILENAME);
      liveStatus.textContent = "이미지 파일을 내려받았습니다.";
    } else {
      liveStatus.textContent = "이미지 저장 화면을 열었습니다.";
    }
  } catch (error) {
    console.error("audience image save error", error);
    liveStatus.classList.add("is-error");
    liveStatus.textContent = "이미지를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    saveImageInFlight = false;
    saveImageButton.disabled = renderedCues.filter(isAudienceSong).length === 0;
    saveImageButton.classList.remove("is-saving");
    saveImageButton.textContent = defaultButtonText;
  }
}

async function createAudienceImageBlob(cues) {
  await waitForExportFonts();

  const entries = await buildAudienceImageEntries(cues);
  const songCount = entries.filter((entry) => entry.type === CUE_TYPE_SONG).length;
  const logoImage = await loadImage("./imgs/logo.png").catch(() => null);
  const width = 1080;
  const pagePadding = 54;
  const headerHeight = 310;
  const panelPadding = 28;
  const itemGap = 22;
  const listWidth = width - pagePadding * 2;
  const entryHeights = entries.map(getAudienceImageEntryHeight);
  const listContentHeight = entryHeights.reduce((total, height) => total + height, 0)
    + Math.max(entries.length - 1, 0) * itemGap;
  const panelHeight = panelPadding * 2 + listContentHeight;
  const footerHeight = 190;
  const height = headerHeight + panelHeight + footerHeight + 42;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  drawAudienceImageBackground(context, width, height);
  drawAudienceImageHeader(context, width, pagePadding, songCount);
  drawRoundedRect(context, pagePadding, headerHeight - 12, listWidth, panelHeight, 34, "#f8f2e7");

  let y = headerHeight + panelPadding;

  entries.forEach((entry, index) => {
    const entryHeight = entryHeights[index];

    if (entry.type === "part") {
      drawAudiencePartHeading(context, entry, pagePadding + panelPadding, y, listWidth - panelPadding * 2, entryHeight);
    } else if (entry.type === CUE_TYPE_INTERMISSION) {
      drawAudienceIntermissionCard(context, entry, pagePadding + panelPadding, y, listWidth - panelPadding * 2, entryHeight);
    } else {
      drawAudienceSongCard(context, entry, pagePadding + panelPadding, y, listWidth - panelPadding * 2, entryHeight);
    }

    y += entryHeight + itemGap;
  });

  drawAudienceImageFooter(context, width, height, logoImage);

  return canvasToBlob(canvas);
}

async function buildAudienceImageEntries(cues) {
  const entries = [];
  let partNumber = 1;
  let songNumber = 0;
  let shouldRenderPartHeading = true;

  for (const cue of cues) {
    if (cue.type === CUE_TYPE_INTERMISSION) {
      entries.push({
        type: CUE_TYPE_INTERMISSION,
        title: cue.title || "인터미션",
      });
      partNumber += 1;
      shouldRenderPartHeading = true;
      continue;
    }

    if (shouldRenderPartHeading) {
      entries.push({
        type: "part",
        title: `${partNumber}부`,
      });
      shouldRenderPartHeading = false;
    }

    songNumber += 1;
    entries.push({
      type: CUE_TYPE_SONG,
      number: String(songNumber).padStart(2, "0"),
      title: cue.title,
      image: null,
    });
  }

  await Promise.all(entries.map(async (entry) => {
    if (entry.type !== CUE_TYPE_SONG) {
      return;
    }

    const artworkUrl = await resolveAlbumArtwork(entry.title);

    if (!artworkUrl) {
      return;
    }

    entry.image = await loadImage(getProxiedArtworkUrl(artworkUrl)).catch(() => null);
  }));

  return entries;
}

function getAudienceImageEntryHeight(entry) {
  if (entry.type === "part") {
    return 54;
  }

  if (entry.type === CUE_TYPE_INTERMISSION) {
    return 96;
  }

  return 244;
}

function drawAudienceImageBackground(context, width, height) {
  const background = context.createLinearGradient(0, 0, width, height);

  background.addColorStop(0, "#2f4539");
  background.addColorStop(0.45, "#111816");
  background.addColorStop(1, "#080b0a");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const topShade = context.createLinearGradient(0, 0, 0, height);

  topShade.addColorStop(0, "rgba(16, 22, 21, 0.1)");
  topShade.addColorStop(0.42, "rgba(16, 22, 21, 0.02)");
  topShade.addColorStop(1, "rgba(16, 22, 21, 0.72)");
  context.fillStyle = topShade;
  context.fillRect(0, 0, width, height);
}

function drawAudienceImageHeader(context, width, pagePadding, songCount) {
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#d4a944";
  context.font = `900 28px ${EXPORT_FONT_FAMILY}`;
  context.fillText("LIVE SET", pagePadding, 112);

  context.fillStyle = "#fffaf0";
  context.font = `900 76px ${EXPORT_FONT_FAMILY}`;
  context.fillText("오늘의 큐시트", pagePadding, 190);

  context.fillStyle = "rgba(255, 250, 240, 0.74)";
  context.font = `800 30px ${EXPORT_FONT_FAMILY}`;
  context.fillText(`공개된 공연 순서 · ${songCount}곡`, pagePadding, 244);
}

function drawAudiencePartHeading(context, entry, x, y, width, height) {
  context.fillStyle = "#2b3a31";
  context.font = `900 30px ${EXPORT_FONT_FAMILY}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(entry.title, x + 4, y + height / 2 + 3, width);
}

function drawAudienceIntermissionCard(context, entry, x, y, width, height) {
  const gradient = context.createLinearGradient(x, y, x + width, y + height);

  gradient.addColorStop(0, "rgba(21, 29, 25, 0.94)");
  gradient.addColorStop(1, "rgba(43, 58, 49, 0.88)");
  drawRoundedRect(context, x, y, width, height, 28, gradient, "rgba(21, 29, 25, 0.12)");

  context.fillStyle = "#fffaf0";
  context.font = `900 28px ${EXPORT_FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(entry.title, x + width / 2, y + height / 2 + 2, width - 48);
}

function drawAudienceSongCard(context, entry, x, y, width, height) {
  context.save();
  roundedRectPath(context, x, y, width, height, 32);
  context.clip();

  if (entry.image) {
    drawImageCover(context, entry.image, x, y, width, height);
  } else {
    const fallback = context.createLinearGradient(x, y, x + width, y + height);

    fallback.addColorStop(0, "#385243");
    fallback.addColorStop(1, "#0f1614");
    context.fillStyle = fallback;
    context.fillRect(x, y, width, height);
  }

  const verticalShade = context.createLinearGradient(0, y, 0, y + height);

  verticalShade.addColorStop(0, "rgba(0, 0, 0, 0.08)");
  verticalShade.addColorStop(1, "rgba(0, 0, 0, 0.56)");
  context.fillStyle = verticalShade;
  context.fillRect(x, y, width, height);

  const sideShade = context.createLinearGradient(x, 0, x + width, 0);

  sideShade.addColorStop(0, "rgba(0, 0, 0, 0.74)");
  sideShade.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  context.fillStyle = sideShade;
  context.fillRect(x, y, width, height);
  context.restore();

  drawRoundedRect(context, x, y, width, height, 32, "rgba(255, 250, 240, 0)", "rgba(255, 250, 240, 0.16)");

  const innerPadding = 10;
  const numberWidth = 78;
  const numberX = x + innerPadding;
  const panelY = y + innerPadding;
  const panelHeight = height - innerPadding * 2;

  drawRoundedRect(context, numberX, panelY, numberWidth, panelHeight, 22, "rgba(0, 0, 0, 0.62)", "rgba(255, 255, 255, 0.18)");

  context.fillStyle = "#fffaf0";
  context.font = `900 30px ${EXPORT_FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(entry.number, numberX + numberWidth / 2, y + height / 2 + 1);

  const titleX = numberX + numberWidth + 10;
  const titleWidth = width - numberWidth - innerPadding * 2 - 10;

  drawRoundedRect(context, titleX, panelY, titleWidth, panelHeight, 26, "rgba(0, 0, 0, 0.12)", "rgba(255, 255, 255, 0.15)");
  drawSongTitle(context, entry.title, titleX + 28, panelY, titleWidth - 56, panelHeight);
}

function drawSongTitle(context, title, x, y, width, height) {
  context.font = `900 50px ${EXPORT_FONT_FAMILY}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(0, 0, 0, 0.55)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 4;

  const lineHeight = 58;
  const lines = fitTextLines(context, title, width, 2);
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    context.fillText(line, x, startY + index * lineHeight, width);
  });

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
}

function drawAudienceImageFooter(context, width, height, logoImage) {
  const y = height - 150;

  context.globalAlpha = 0.86;

  if (logoImage) {
    drawImageContain(context, logoImage, width / 2 - 140, y, 280, 92);
  } else {
    context.fillStyle = "#fffaf0";
    context.font = `900 44px ${EXPORT_FONT_FAMILY}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("ㅅㅁㅅ", width / 2, y + 46);
  }

  context.globalAlpha = 1;
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawImageContain(context, image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const targetWidth = image.naturalWidth * scale;
  const targetHeight = image.naturalHeight * scale;
  const targetX = x + (width - targetWidth) / 2;
  const targetY = y + (height - targetHeight) / 2;

  context.drawImage(image, targetX, targetY, targetWidth, targetHeight);
}

function fitTextLines(context, value, maxWidth, maxLines) {
  const chars = Array.from(String(value || "").trim());
  const lines = [];
  let line = "";

  for (const char of chars) {
    const candidate = line + char;

    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = char;

      if (lines.length === maxLines) {
        break;
      }
    } else {
      line = candidate;
    }
  }

  if (line && lines.length < maxLines) {
    lines.push(line);
  }

  if (lines.length === maxLines) {
    const consumed = lines.join("").length;

    if (consumed < chars.length) {
      lines[maxLines - 1] = trimTextToWidth(context, `${lines[maxLines - 1]}...`, maxWidth);
    }
  }

  return lines.length ? lines : [""];
}

function trimTextToWidth(context, value, maxWidth) {
  let text = value;

  while (text.length > 1 && context.measureText(text).width > maxWidth) {
    text = `${text.slice(0, -4)}...`;
  }

  return text;
}

function drawRoundedRect(context, x, y, width, height, radius, fillStyle, strokeStyle = "") {
  context.save();
  roundedRectPath(context, x, y, width, height, radius);

  if (fillStyle) {
    context.fillStyle = fillStyle;
    context.fill();
  }

  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = 2;
    context.stroke();
  }

  context.restore();
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function getProxiedArtworkUrl(url) {
  const proxyUrl = new URL(ALBUM_IMAGE_PROXY_ENDPOINT, window.location.origin);

  proxyUrl.searchParams.set("url", url);

  return proxyUrl.toString();
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${url}`));
    image.src = url;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Unable to export canvas."));
    }, "image/png");
  });
}

async function shareImageFile(file) {
  if (!file || !navigator.share || !navigator.canShare) {
    return false;
  }

  try {
    if (!navigator.canShare({ files: [file] })) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    await navigator.share({
      files: [file],
      title: "오늘의 큐시트",
      text: "공연 순서 이미지",
    });

    return true;
  } catch (error) {
    if (error?.name === "AbortError") {
      liveStatus.textContent = "이미지 저장을 취소했습니다.";
      return true;
    }

    return false;
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 1000);
}

async function waitForExportFonts() {
  if (!document.fonts?.ready) {
    return;
  }

  try {
    await document.fonts.ready;
  } catch {
    // The canvas can still render with the fallback font if webfont loading fails.
  }
}

function isAudienceSong(cue) {
  return Boolean(cue) && cue.type !== CUE_TYPE_INTERMISSION;
}

function hydrateAlbumArtwork(item, cue) {
  resolveAlbumArtwork(cue.title)
    .then((url) => {
      if (url && item.isConnected) {
        applyAlbumArtwork(item, url);
      }
    })
    .catch(() => {});
}

async function resolveAlbumArtwork(title) {
  const customArtworkUrl = findCustomAlbumArtwork(title);

  if (customArtworkUrl) {
    return customArtworkUrl;
  }

  const cacheKey = getAlbumCacheKey(title);

  if (!cacheKey) {
    return "";
  }

  const cached = albumArtworkCache[cacheKey];

  if (cached && Date.now() - cached.cachedAt < ALBUM_CACHE_MAX_AGE_MS) {
    return cached.url || "";
  }

  try {
    const url = await fetchAlbumArtwork(title);

    albumArtworkCache = {
      ...albumArtworkCache,
      [cacheKey]: {
        cachedAt: Date.now(),
        url: url || "",
      },
    };
    writeAlbumArtworkCache(albumArtworkCache);

    return url || "";
  } catch {
    albumArtworkCache = {
      ...albumArtworkCache,
      [cacheKey]: {
        cachedAt: Date.now(),
        url: "",
      },
    };
    writeAlbumArtworkCache(albumArtworkCache);

    return "";
  }
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

function findCustomAlbumArtwork(title) {
  const normalizedTitle = normalizeSearchText(title).replaceAll(" ", "");

  for (const [customTitle, artworkUrl] of CUSTOM_ALBUM_ARTWORK_BY_TITLE) {
    if (normalizeSearchText(customTitle).replaceAll(" ", "") === normalizedTitle) {
      return artworkUrl;
    }
  }

  return "";
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
