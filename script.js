const CUES_API_ENDPOINT = "/api/cues";
const AUTH_SESSION_ENDPOINT = "/api/auth/session";
const AUTH_REQUEST_CODE_ENDPOINT = "/api/auth/request-code";
const AUTH_VERIFY_CODE_ENDPOINT = "/api/auth/verify-code";
const AUTH_LOGOUT_ENDPOINT = "/api/auth/logout";
const ANONYMOUS_STORAGE_KEY = "cue-sheet-anonymous-draft";
const USER_STORAGE_PREFIX = "cue-sheet-user-cache:";
const ACOUSTIC_TUNING_FIELD = "acousticTuning";
const ELECTRIC_TUNING_FIELD = "electricTuning";
const BASS_TUNING_FIELD = "bassTuning";
const TUNING_FIELDS = new Set([
  ACOUSTIC_TUNING_FIELD,
  ELECTRIC_TUNING_FIELD,
  BASS_TUNING_FIELD,
]);
const TUNING_STANDARD = "standard";
const TUNING_HALF_DOWN = "half-down";
const TUNING_D_DROP = "d-drop";
const TUNING_INACTIVE = "inactive";
const TAP_TEMPO_RESET_MS = 2500;
const TAP_TEMPO_MAX_TAPS = 8;
const STORAGE_MODE_LOADING = "loading";
const STORAGE_MODE_DATABASE = "database";
const STORAGE_MODE_LOCAL = "local";
const AUTH_STATE_LOADING = "loading";
const AUTH_STATE_GUEST = "guest";
const AUTH_STATE_AUTHENTICATED = "authenticated";

const requestCodeForm = document.querySelector("#requestCodeForm");
const verifyCodeForm = document.querySelector("#verifyCodeForm");
const emailInput = document.querySelector("#emailInput");
const codeInput = document.querySelector("#codeInput");
const requestCodeButton = document.querySelector("#requestCodeButton");
const verifyCodeButton = document.querySelector("#verifyCodeButton");
const logoutButton = document.querySelector("#logoutButton");
const authTitle = document.querySelector("#authTitle");
const authStatus = document.querySelector("#authStatus");
const cueForm = document.querySelector("#cueForm");
const titleInput = document.querySelector("#titleInput");
const bpmInput = document.querySelector("#bpmInput");
const durationInput = document.querySelector("#durationInput");
const cueList = document.querySelector("#cueList");
const emptyState = document.querySelector("#emptyState");
const totalDuration = document.querySelector("#totalDuration");
const saveButton = document.querySelector("#saveButton");
const saveStatus = document.querySelector("#saveStatus");
const clearAllButton = document.querySelector("#clearAllButton");
const tapTempoButton = document.querySelector("#tapTempoButton");
const tapTempoApplyButton = document.querySelector("#tapTempoApplyButton");
const tapTempoResetButton = document.querySelector("#tapTempoResetButton");
const tapTempoValue = document.querySelector("#tapTempoValue");
const tapTempoStatus = document.querySelector("#tapTempoStatus");
const cueItemTemplate = document.querySelector("#cueItemTemplate");

let savedCues = [];
let cues = [];
let armedDragId = null;
let activeMetronomeId = null;
let metronomeTimer = null;
let metronomeAudioContext = null;
let tapTempoClicks = [];
let measuredTapBpm = "";
let storageMode = STORAGE_MODE_LOADING;
let authState = AUTH_STATE_LOADING;
let authBusy = false;
let authenticatedEmail = "";
let pendingEmail = "";
let authMessage = "";
let emailLoginConfigured = false;
let databaseConfigured = false;
let saveInFlight = false;
let databaseSeedRequired = false;
let storageWarningMessage = "";

requestCodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (authBusy || authState === AUTH_STATE_LOADING) {
    return;
  }

  const email = normalizeEmail(emailInput.value);

  if (!isValidEmail(email)) {
    authMessage = "올바른 이메일 주소를 입력하세요.";
    updateAuthUi();
    emailInput.focus();
    return;
  }

  authBusy = true;
  authMessage = "인증코드를 보내는 중입니다.";
  updateAuthUi();

  const result = await requestLoginCode(email);

  authBusy = false;

  if (!result.ok) {
    authMessage = result.message;
    updateAuthUi();
    return;
  }

  pendingEmail = email;
  emailInput.value = email;
  codeInput.value = "";
  authMessage = `${maskEmail(email)}로 인증코드를 보냈습니다. 메일함에서 6자리 코드를 확인하세요.`;
  updateAuthUi();
  codeInput.focus();
});

verifyCodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (authBusy || !pendingEmail) {
    return;
  }

  const code = codeInput.value.trim();

  if (!/^\d{6}$/.test(code)) {
    authMessage = "6자리 인증코드를 입력하세요.";
    updateAuthUi();
    codeInput.focus();
    codeInput.select();
    return;
  }

  authBusy = true;
  authMessage = "로그인 처리 중입니다.";
  updateAuthUi();

  const result = await verifyLoginCode(pendingEmail, code);

  authBusy = false;

  if (!result.ok) {
    authMessage = result.message;
    updateAuthUi();
    codeInput.focus();
    codeInput.select();
    return;
  }

  authenticatedEmail = result.email;
  pendingEmail = "";
  authState = AUTH_STATE_AUTHENTICATED;
  authMessage = `${result.email}로 로그인되었습니다. 저장된 큐시트를 불러옵니다.`;
  await initializeStorageForEmail(result.email);
  updateAuthUi();
});

logoutButton.addEventListener("click", async () => {
  if (authBusy) {
    return;
  }

  authBusy = true;
  authMessage = "로그아웃하는 중입니다.";
  updateAuthUi();

  await logoutSession();

  authBusy = false;
  authenticatedEmail = "";
  pendingEmail = "";
  authState = AUTH_STATE_GUEST;
  authMessage = "로그아웃되었습니다. 이메일 로그인 후 DB 저장이 가능합니다.";
  initializeGuestStorage();
  updateAuthUi();
});

cueForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const rawDuration = durationInput.value.trim();
  const seconds = parseDuration(rawDuration);

  if (!title) {
    titleInput.focus();
    return;
  }

  if (seconds === null) {
    alert("시간 형식이 올바르지 않습니다. MM:SS 형식으로 입력하세요.");
    durationInput.focus();
    durationInput.select();
    return;
  }

  cues.push({
    id: createCueId(),
    title,
    bpm: normalizeBpm(bpmInput.value),
    seconds,
    acousticTuning: TUNING_STANDARD,
    electricTuning: TUNING_STANDARD,
    bassTuning: TUNING_STANDARD,
  });

  render();
  cueForm.reset();
  titleInput.focus();
});

saveButton.addEventListener("click", async () => {
  if (
    saveInFlight ||
    storageMode === STORAGE_MODE_LOADING ||
    authState !== AUTH_STATE_AUTHENTICATED
  ) {
    return;
  }

  saveInFlight = true;
  updateActionState();

  const didSave = await persistCurrentCues(cues);

  saveInFlight = false;

  if (!didSave) {
    updateActionState();
    alert(
      storageMode === STORAGE_MODE_DATABASE
        ? "DB 저장에 실패했습니다. 다시 로그인하거나 잠시 후 다시 시도하세요."
        : "현재는 DB 저장이 불가능합니다.",
    );
    return;
  }

  savedCues = cloneCues(cues);
  databaseSeedRequired = false;
  updateActionState(true);
});

clearAllButton.addEventListener("click", () => {
  if (!cues.length || storageMode === STORAGE_MODE_LOADING) {
    return;
  }

  const confirmed = window.confirm("등록된 큐시트를 모두 삭제하시겠습니까?");

  if (!confirmed) {
    return;
  }

  stopMetronome();
  cues = [];
  render();
});

bpmInput.addEventListener("input", () => {
  bpmInput.value = normalizeBpm(bpmInput.value);
});

tapTempoButton.addEventListener("click", () => {
  registerTapTempoClick();
});

tapTempoApplyButton.addEventListener("click", () => {
  if (!measuredTapBpm) {
    return;
  }

  bpmInput.value = measuredTapBpm;
  bpmInput.focus();
  bpmInput.select();
});

tapTempoResetButton.addEventListener("click", () => {
  resetTapTempo();
});

cueList.addEventListener("input", (event) => {
  const bpmListInput = event.target.closest(".bpm-list-input");

  if (!bpmListInput) {
    return;
  }

  const item = bpmListInput.closest(".cue-item");

  if (!item) {
    return;
  }

  const cue = cues.find((entry) => entry.id === item.dataset.id);

  if (!cue) {
    return;
  }

  const nextBpm = normalizeBpm(bpmListInput.value);

  bpmListInput.value = nextBpm;
  cue.bpm = nextBpm;

  if (activeMetronomeId === item.dataset.id) {
    rescheduleMetronome();
  }

  updateActionState();
});

cueList.addEventListener("click", (event) => {
  const metronomeButton = event.target.closest(".metronome-button");

  if (metronomeButton) {
    const item = metronomeButton.closest(".cue-item");

    if (item) {
      toggleMetronome(item.dataset.id);
    }

    return;
  }

  const deleteButton = event.target.closest(".delete-button");

  if (!deleteButton) {
    return;
  }

  const item = deleteButton.closest(".cue-item");

  if (!item) {
    return;
  }

  deleteCue(item.dataset.id);
});

cueList.addEventListener("change", (event) => {
  const tuningSelect = event.target.closest(".tuning-select");

  if (!tuningSelect) {
    return;
  }

  const item = tuningSelect.closest(".cue-item");

  if (!item) {
    return;
  }

  const field = tuningSelect.dataset.field;

  if (!TUNING_FIELDS.has(field)) {
    return;
  }

  const cue = cues.find((entry) => entry.id === item.dataset.id);

  if (!cue) {
    return;
  }

  const nextValue = normalizeTuning(field, tuningSelect.value);

  cue[field] = nextValue;
  syncTuningCell(tuningSelect.closest(".tuning-cell"), field, nextValue);
  updateActionState();
});

cueList.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".drag-handle");

  if (!handle) {
    armedDragId = null;
    return;
  }

  const item = handle.closest(".cue-item");

  armedDragId = item?.dataset.id ?? null;
});

window.addEventListener("pointerup", () => {
  armedDragId = null;
});

window.addEventListener("pointercancel", () => {
  armedDragId = null;
});

cueList.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".cue-item");

  if (!item || item.dataset.id !== armedDragId) {
    event.preventDefault();
    return;
  }

  item.classList.add("is-dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.dataset.id);
  }
});

cueList.addEventListener("dragover", (event) => {
  event.preventDefault();

  const draggingItem = cueList.querySelector(".cue-item.is-dragging");

  if (!draggingItem) {
    return;
  }

  const nextItem = getDragAfterElement(cueList, event.clientY);

  if (!nextItem) {
    cueList.appendChild(draggingItem);
    return;
  }

  cueList.insertBefore(draggingItem, nextItem);
});

cueList.addEventListener("drop", (event) => {
  event.preventDefault();
});

cueList.addEventListener("dragend", (event) => {
  const item = event.target.closest(".cue-item");

  if (item) {
    item.classList.remove("is-dragging");
  }

  armedDragId = null;
  syncCueOrderWithDom();
});

window.addEventListener("beforeunload", (event) => {
  if (!hasPendingChanges()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("pagehide", () => {
  stopMetronome();
});

bootstrap();

async function bootstrap() {
  render();
  updateTapTempoState();
  updateAuthUi();
  await restoreSession();
}

async function restoreSession() {
  authState = AUTH_STATE_LOADING;
  storageMode = STORAGE_MODE_LOADING;
  updateAuthUi();
  updateActionState();

  const sessionResult = await fetchSession();

  emailLoginConfigured = sessionResult.emailLoginConfigured;
  databaseConfigured = sessionResult.databaseConfigured;

  if (sessionResult.authenticated) {
    authState = AUTH_STATE_AUTHENTICATED;
    authenticatedEmail = sessionResult.email;
    pendingEmail = "";
    authMessage = `${sessionResult.email}로 로그인되었습니다. 저장된 큐시트를 확인합니다.`;
    await initializeStorageForEmail(sessionResult.email);
    updateAuthUi();
    return;
  }

  authState = AUTH_STATE_GUEST;
  authenticatedEmail = "";
  pendingEmail = "";
  authMessage = sessionResult.message || "이메일 로그인 후 사용자별 큐시트를 저장할 수 있습니다.";
  initializeGuestStorage();
  updateAuthUi();
}

function initializeGuestStorage() {
  const localCues = loadLocalCues("");

  savedCues = cloneCues(localCues);
  cues = cloneCues(localCues);
  storageMode = STORAGE_MODE_LOCAL;
  databaseSeedRequired = false;
  storageWarningMessage = databaseConfigured
    ? ""
    : "DB 연결이 아직 설정되지 않았습니다.";
  render();
}

async function initializeStorageForEmail(email) {
  const localCues = loadLocalCues(email);

  savedCues = cloneCues(localCues);
  cues = cloneCues(localCues);
  storageMode = STORAGE_MODE_LOADING;
  databaseSeedRequired = false;
  storageWarningMessage = "";
  render();

  const remoteResult = await loadRemoteCues();

  if (remoteResult.authExpired) {
    authState = AUTH_STATE_GUEST;
    authenticatedEmail = "";
    pendingEmail = "";
    authMessage = "로그인이 만료되었습니다. 다시 로그인하세요.";
    initializeGuestStorage();
    updateAuthUi();
    return;
  }

  if (!remoteResult.ok) {
    storageMode = STORAGE_MODE_LOCAL;
    storageWarningMessage = remoteResult.message;
    render();
    return;
  }

  storageMode = STORAGE_MODE_DATABASE;
  storageWarningMessage = "";

  if (!remoteResult.items.length && localCues.length) {
    cues = cloneCues(localCues);
    savedCues = [];
    databaseSeedRequired = true;
    render();
    return;
  }

  const remoteCues = cloneCues(remoteResult.items);

  savedCues = remoteCues;
  cues = cloneCues(remoteCues);
  persistLocalCues(remoteCues, email);
  render();
}

function loadLocalCues(email) {
  try {
    const saved = window.localStorage.getItem(getStorageKey(email));

    if (!saved) {
      return [];
    }

    return normalizeCueCollection(JSON.parse(saved));
  } catch {
    return [];
  }
}

function persistLocalCues(items, email = authenticatedEmail) {
  try {
    window.localStorage.setItem(
      getStorageKey(email),
      JSON.stringify(normalizeCueCollection(items)),
    );
    return true;
  } catch {
    return false;
  }
}

function getStorageKey(email) {
  if (!email) {
    return ANONYMOUS_STORAGE_KEY;
  }

  return `${USER_STORAGE_PREFIX}${normalizeEmail(email)}`;
}

async function fetchSession() {
  try {
    const response = await fetch(AUTH_SESSION_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const payload = await safeReadJson(response);

    return {
      authenticated: Boolean(payload.authenticated && payload.email),
      email: payload.email || "",
      databaseConfigured: Boolean(payload.databaseConfigured),
      emailLoginConfigured: Boolean(payload.emailLoginConfigured),
      message: payload.message || "",
    };
  } catch {
    return {
      authenticated: false,
      email: "",
      databaseConfigured: false,
      emailLoginConfigured: false,
      message: "로그인 상태를 확인하지 못했습니다. 새로고침 후 다시 시도하세요.",
    };
  }
}

async function requestLoginCode(email) {
  try {
    const response = await fetch(AUTH_REQUEST_CODE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      return {
        ok: false,
        message: payload.message || "인증코드 발송에 실패했습니다.",
      };
    }

    return {
      ok: true,
      email: payload.email || email,
    };
  } catch {
    return {
      ok: false,
      message: "인증코드를 보내지 못했습니다.",
    };
  }
}

async function verifyLoginCode(email, code) {
  try {
    const response = await fetch(AUTH_VERIFY_CODE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, code }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      return {
        ok: false,
        message: payload.message || "로그인에 실패했습니다.",
      };
    }

    return {
      ok: true,
      email: payload.email || email,
    };
  } catch {
    return {
      ok: false,
      message: "로그인 요청을 완료하지 못했습니다.",
    };
  }
}

async function logoutSession() {
  try {
    await fetch(AUTH_LOGOUT_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    authMessage = "로그아웃 요청을 완료하지 못했습니다. 브라우저를 새로고침해 주세요.";
  }
}

async function loadRemoteCues() {
  try {
    const response = await fetch(CUES_API_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await safeReadJson(response);

    if (response.status === 401) {
      return {
        ok: false,
        authExpired: true,
        message: payload.message || "로그인이 필요합니다.",
      };
    }

    if (!response.ok) {
      if (response.status === 503) {
        return {
          ok: false,
          message: "DB가 아직 연결되지 않았습니다.",
        };
      }

      return {
        ok: false,
        message: payload.message || "DB에서 큐시트를 불러오지 못했습니다.",
      };
    }

    return {
      ok: true,
      items: normalizeCueCollection(payload.items),
    };
  } catch {
    return {
      ok: false,
      message: "DB에 연결할 수 없어 로컬 캐시만 사용합니다.",
    };
  }
}

async function persistRemoteCues(items) {
  try {
    const response = await fetch(CUES_API_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ items }),
    });
    const payload = await safeReadJson(response);

    if (response.status === 401) {
      return {
        ok: false,
        authExpired: true,
        message: payload.message || "로그인이 만료되었습니다.",
      };
    }

    return {
      ok: response.ok,
      message: payload.message || "",
    };
  } catch {
    return {
      ok: false,
      message: "저장 요청을 완료하지 못했습니다.",
    };
  }
}

async function persistCurrentCues(items) {
  const nextItems = normalizeCueCollection(items);
  const localSaved = persistLocalCues(nextItems, authenticatedEmail);

  if (storageMode !== STORAGE_MODE_DATABASE) {
    return localSaved;
  }

  const remoteSaved = await persistRemoteCues(nextItems);

  if (remoteSaved.authExpired) {
    authState = AUTH_STATE_GUEST;
    authenticatedEmail = "";
    pendingEmail = "";
    authMessage = "로그인이 만료되었습니다. 다시 로그인하세요.";
    initializeGuestStorage();
    updateAuthUi();
    return false;
  }

  return localSaved && remoteSaved.ok;
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

  const title = typeof item.title === "string" ? item.title.trim() : "";
  const seconds = Number(item.seconds);

  if (!title || !Number.isInteger(seconds) || seconds < 0) {
    return null;
  }

  return {
    id: normalizeCueId(item.id, index),
    title: title.slice(0, 60),
    bpm: normalizeBpm(item.bpm),
    seconds,
    acousticTuning: normalizeTuning(ACOUSTIC_TUNING_FIELD, item.acousticTuning),
    electricTuning: normalizeTuning(ELECTRIC_TUNING_FIELD, item.electricTuning),
    bassTuning: normalizeTuning(BASS_TUNING_FIELD, item.bassTuning),
  };
}

function normalizeCueId(value, index) {
  if (typeof value !== "string") {
    return `cue-${index + 1}`;
  }

  const normalized = value.trim();

  if (!normalized) {
    return `cue-${index + 1}`;
  }

  return normalized.slice(0, 120);
}

function cloneCues(items) {
  return items.map((item) => ({ ...item }));
}

function render() {
  if (activeMetronomeId && !cues.some((cue) => cue.id === activeMetronomeId)) {
    stopMetronome();
  }

  cueList.innerHTML = "";

  if (!cues.length) {
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
  }

  for (const cue of cues) {
    const fragment = cueItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".cue-item");
    const title = fragment.querySelector(".cue-title");
    const bpmListInput = fragment.querySelector(".bpm-list-input");
    const duration = fragment.querySelector(".cue-duration");
    const tuningSelects = fragment.querySelectorAll(".tuning-select");

    title.textContent = cue.title;
    bpmListInput.value = normalizeBpm(cue.bpm);
    duration.textContent = formatDuration(cue.seconds);
    item.dataset.id = cue.id;

    for (const select of tuningSelects) {
      const field = select.dataset.field;

      if (!TUNING_FIELDS.has(field)) {
        continue;
      }

      const tuningValue = normalizeTuning(field, cue[field]);

      select.value = tuningValue;
      syncTuningCell(select.closest(".tuning-cell"), field, tuningValue);
    }

    cueList.appendChild(fragment);
  }

  totalDuration.textContent = formatDuration(
    cues.reduce((sum, cue) => sum + cue.seconds, 0),
  );

  updateActionState();
  syncMetronomeButtons();
}

function deleteCue(id) {
  if (activeMetronomeId === id) {
    stopMetronome();
  }

  cues = cues.filter((cue) => cue.id !== id);
  render();
}

function parseDuration(value) {
  const parts = value.split(":").map((part) => part.trim());

  if (parts.length !== 2 || parts.some((part) => part === "")) {
    return null;
  }

  const numbers = parts.map(Number);

  if (numbers.some((num) => !Number.isInteger(num) || num < 0)) {
    return null;
  }

  let minutes = 0;
  let seconds = 0;

  [minutes, seconds] = numbers;

  if (seconds >= 60) {
    return null;
  }

  return (minutes * 60) + seconds;
}

function createCueId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `cue-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTuning(field, value) {
  if (typeof value !== "string") {
    return TUNING_STANDARD;
  }

  const normalized = value.trim().toLowerCase();

  if (
    field === BASS_TUNING_FIELD &&
    (
      normalized === TUNING_D_DROP ||
      normalized === "d 드랍" ||
      normalized === "d드랍"
    )
  ) {
    return TUNING_D_DROP;
  }

  if (
    field !== ELECTRIC_TUNING_FIELD &&
    (
      normalized === TUNING_INACTIVE ||
      normalized === "참여 안함" ||
      normalized === "미참여"
    )
  ) {
    return TUNING_INACTIVE;
  }

  if (normalized === TUNING_HALF_DOWN || normalized === "하프다운") {
    return TUNING_HALF_DOWN;
  }

  return TUNING_STANDARD;
}

function normalizeBpm(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\D/g, "").slice(0, 3);
}

function registerTapTempoClick() {
  const now = performance.now();
  const previousClick = tapTempoClicks.at(-1);

  if (previousClick && now - previousClick > TAP_TEMPO_RESET_MS) {
    tapTempoClicks = [];
  }

  tapTempoClicks.push(now);

  if (tapTempoClicks.length > TAP_TEMPO_MAX_TAPS) {
    tapTempoClicks.shift();
  }

  if (tapTempoClicks.length < 2) {
    measuredTapBpm = "";
    updateTapTempoState();
    return;
  }

  const intervals = tapTempoClicks
    .slice(1)
    .map((clickTime, index) => clickTime - tapTempoClicks[index]);
  const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

  measuredTapBpm = normalizeBpm(Math.round(60000 / averageInterval));
  bpmInput.value = measuredTapBpm;
  updateTapTempoState();
}

function resetTapTempo() {
  tapTempoClicks = [];
  measuredTapBpm = "";
  updateTapTempoState();
}

function updateTapTempoState() {
  tapTempoValue.textContent = measuredTapBpm || "--";
  tapTempoApplyButton.disabled = !measuredTapBpm;
  tapTempoResetButton.disabled = tapTempoClicks.length === 0;

  if (measuredTapBpm) {
    tapTempoStatus.textContent = `${tapTempoClicks.length}회 클릭 기준으로 측정했습니다.`;
    return;
  }

  if (tapTempoClicks.length === 1) {
    tapTempoStatus.textContent = "한 번 더 누르면 BPM을 계산합니다.";
    return;
  }

  tapTempoStatus.textContent = "박자에 맞춰 TAP을 눌러 BPM을 측정합니다.";
}

function getBpmNumber(value) {
  const bpm = Number(normalizeBpm(value));

  if (!Number.isInteger(bpm) || bpm <= 0) {
    return null;
  }

  return bpm;
}

async function toggleMetronome(id) {
  if (activeMetronomeId === id) {
    stopMetronome();
    return;
  }

  const cue = cues.find((entry) => entry.id === id);
  const bpm = getBpmNumber(cue?.bpm);

  if (!cue || bpm === null) {
    const item = [...cueList.querySelectorAll(".cue-item")]
      .find((listItem) => listItem.dataset.id === id);
    const bpmListInput = item?.querySelector(".bpm-list-input");

    alert("BPM을 먼저 입력하세요.");
    bpmListInput?.focus();
    bpmListInput?.select();
    return;
  }

  stopMetronome();

  try {
    await ensureMetronomeAudioContext();
  } catch {
    alert("이 브라우저에서 메트로놈을 재생할 수 없습니다.");
    return;
  }

  activeMetronomeId = id;
  syncMetronomeButtons();
  playMetronomeTick();
  scheduleNextMetronomeTick(bpm);
}

async function ensureMetronomeAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("AudioContext is not supported.");
  }

  if (!metronomeAudioContext) {
    metronomeAudioContext = new AudioContextConstructor();
  }

  if (metronomeAudioContext.state === "suspended") {
    await metronomeAudioContext.resume();
  }
}

function scheduleNextMetronomeTick(bpm) {
  metronomeTimer = window.setTimeout(() => {
    if (!activeMetronomeId) {
      return;
    }

    const activeCue = cues.find((cue) => cue.id === activeMetronomeId);
    const nextBpm = getBpmNumber(activeCue?.bpm);

    if (nextBpm === null) {
      stopMetronome();
      return;
    }

    playMetronomeTick();
    scheduleNextMetronomeTick(nextBpm);
  }, 60000 / bpm);
}

function rescheduleMetronome() {
  if (!activeMetronomeId) {
    return;
  }

  window.clearTimeout(metronomeTimer);

  const activeCue = cues.find((cue) => cue.id === activeMetronomeId);
  const bpm = getBpmNumber(activeCue?.bpm);

  if (bpm === null) {
    stopMetronome();
    return;
  }

  scheduleNextMetronomeTick(bpm);
}

function playMetronomeTick() {
  if (!metronomeAudioContext) {
    return;
  }

  const now = metronomeAudioContext.currentTime;
  const oscillator = metronomeAudioContext.createOscillator();
  const gain = metronomeAudioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1200, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  oscillator.connect(gain);
  gain.connect(metronomeAudioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.05);
}

function stopMetronome() {
  window.clearTimeout(metronomeTimer);
  metronomeTimer = null;
  activeMetronomeId = null;
  syncMetronomeButtons();
}

function syncMetronomeButtons() {
  const buttons = cueList.querySelectorAll(".metronome-button");

  for (const button of buttons) {
    const item = button.closest(".cue-item");
    const isPlaying = Boolean(item && item.dataset.id === activeMetronomeId);

    button.classList.toggle("is-playing", isPlaying);
    button.setAttribute("aria-pressed", String(isPlaying));
    button.setAttribute("aria-label", isPlaying ? "메트로놈 정지" : "메트로놈 재생");
    button.title = isPlaying ? "메트로놈 정지" : "메트로놈 재생";
  }
}

function syncTuningCell(cell, field, value) {
  if (!cell) {
    return;
  }

  cell.dataset.tuning = normalizeTuning(field, value);
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function hasPendingChanges() {
  return JSON.stringify(cues) !== JSON.stringify(savedCues);
}

function updateActionState(saved = false) {
  if (storageMode !== STORAGE_MODE_LOADING) {
    persistLocalCues(cues, authenticatedEmail);
  }

  const dirty = hasPendingChanges();
  const needsAttention = dirty || databaseSeedRequired;
  const isAuthenticated = authState === AUTH_STATE_AUTHENTICATED;

  saveButton.disabled = (
    !isAuthenticated ||
    storageMode === STORAGE_MODE_LOADING ||
    saveInFlight ||
    !dirty
  );
  clearAllButton.disabled = storageMode === STORAGE_MODE_LOADING || saveInFlight || cues.length === 0;
  saveStatus.classList.toggle("is-dirty", needsAttention);
  saveStatus.classList.toggle(
    "is-error",
    storageMode === STORAGE_MODE_LOCAL && Boolean(storageWarningMessage),
  );

  saveButton.textContent = isAuthenticated ? "DB 저장" : "이메일 로그인 필요";

  if (authState === AUTH_STATE_LOADING || storageMode === STORAGE_MODE_LOADING) {
    saveStatus.textContent = "로그인과 저장 상태를 확인하는 중입니다.";
    return;
  }

  if (!isAuthenticated) {
    saveStatus.textContent = emailLoginConfigured
      ? "이메일 로그인 후 사용자별 큐시트를 DB에 저장할 수 있습니다. 현재 작업은 이 브라우저에만 남습니다."
      : "이메일 로그인 메일 발송 설정이 아직 완료되지 않았습니다.";
    return;
  }

  if (saveInFlight) {
    saveStatus.textContent = storageMode === STORAGE_MODE_DATABASE
      ? "현재 순서를 DB에 저장하는 중입니다."
      : "현재 순서를 브라우저에 임시 저장하는 중입니다.";
    return;
  }

  if (saved) {
    saveStatus.textContent = storageMode === STORAGE_MODE_DATABASE
      ? `현재 순서를 ${authenticatedEmail} 계정의 DB에 저장했습니다.`
      : "DB 저장에 실패해 이 브라우저에만 보관했습니다.";
    return;
  }

  if (storageMode === STORAGE_MODE_DATABASE) {
    if (databaseSeedRequired) {
      saveStatus.textContent = "처음 로그인한 계정입니다. DB 저장을 누르면 현재 목록이 이 이메일 계정에 저장됩니다.";
      return;
    }

    if (dirty) {
      saveStatus.textContent = "저장되지 않은 변경사항이 있습니다. DB 저장을 누르면 현재 이메일 계정에 반영됩니다.";
      return;
    }

    saveStatus.textContent = `현재 순서가 ${authenticatedEmail} 계정에 저장되어 있습니다.`;
    return;
  }

  if (dirty) {
    saveStatus.textContent = "DB 연결에 문제가 있어 현재 작업은 이 브라우저에만 남습니다.";
    return;
  }

  saveStatus.textContent = storageWarningMessage || "DB 연결에 문제가 있어 브라우저 캐시만 사용 중입니다.";
}

function updateAuthUi() {
  requestCodeForm.hidden = authState === AUTH_STATE_AUTHENTICATED;
  verifyCodeForm.hidden = authState === AUTH_STATE_AUTHENTICATED || !pendingEmail;
  logoutButton.hidden = authState !== AUTH_STATE_AUTHENTICATED;

  emailInput.disabled = authBusy || !emailLoginConfigured || authState === AUTH_STATE_LOADING;
  requestCodeButton.disabled = authBusy || !emailLoginConfigured || authState === AUTH_STATE_LOADING;
  codeInput.disabled = authBusy;
  verifyCodeButton.disabled = authBusy || !pendingEmail;
  logoutButton.disabled = authBusy;

  if (authState === AUTH_STATE_LOADING) {
    authTitle.textContent = "로그인 상태를 확인하는 중입니다.";
    authStatus.textContent = "세션과 DB 연결을 확인하는 중입니다.";
    return;
  }

  if (authState === AUTH_STATE_AUTHENTICATED) {
    authTitle.textContent = authenticatedEmail;
    authStatus.textContent = authMessage || `${authenticatedEmail}로 로그인되어 있습니다.`;
    return;
  }

  authTitle.textContent = "이메일 인증 로그인";

  if (!emailLoginConfigured) {
    authStatus.textContent = "이메일 로그인 설정이 아직 완료되지 않았습니다. RESEND_API_KEY와 AUTH_EMAIL_FROM이 필요합니다.";
    return;
  }

  if (pendingEmail) {
    authStatus.textContent = authMessage || `${maskEmail(pendingEmail)}로 인증코드를 보냈습니다.`;
    return;
  }

  authStatus.textContent = authMessage || "이메일 로그인 후 각 이메일 계정별로 큐시트를 저장할 수 있습니다.";
}

function getDragAfterElement(container, pointerY) {
  const items = [...container.querySelectorAll(".cue-item:not(.is-dragging)")];
  let closestItem = null;
  let closestOffset = Number.NEGATIVE_INFINITY;

  for (const item of items) {
    const box = item.getBoundingClientRect();
    const offset = pointerY - box.top - (box.height / 2);

    if (offset < 0 && offset > closestOffset) {
      closestOffset = offset;
      closestItem = item;
    }
  }

  return closestItem;
}

function syncCueOrderWithDom() {
  const orderedIds = [...cueList.querySelectorAll(".cue-item")]
    .map((item) => item.dataset.id);

  if (!orderedIds.length) {
    updateActionState();
    return;
  }

  const cueMap = new Map(cues.map((cue) => [cue.id, cue]));
  const nextCues = orderedIds.map((id) => cueMap.get(id)).filter(Boolean);

  if (nextCues.length !== cues.length) {
    render();
    return;
  }

  cues = nextCues;
  updateActionState();
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function maskEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const [localPart = "", domain = ""] = normalizedEmail.split("@");

  if (!domain) {
    return normalizedEmail;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || ""}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}
