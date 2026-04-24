const STORAGE_KEY = "cue-sheet-items";
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

let savedCues = loadCues();
let cues = cloneCues(savedCues);
let armedDragId = null;
let activeMetronomeId = null;
let metronomeTimer = null;
let metronomeAudioContext = null;
let tapTempoClicks = [];
let measuredTapBpm = "";

render();
updateTapTempoState();

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

saveButton.addEventListener("click", () => {
  const didSave = persistCues(cues);

  if (!didSave) {
    alert("로컬 저장에 실패했습니다.");
    return;
  }

  savedCues = cloneCues(cues);
  updateActionState(true);
});

clearAllButton.addEventListener("click", () => {
  if (!cues.length) {
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

function loadCues() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => (
      typeof item?.id === "string" &&
      typeof item?.title === "string" &&
      Number.isFinite(item?.seconds)
    )).map((item) => ({
      id: item.id,
      title: item.title,
      bpm: normalizeBpm(item.bpm),
      seconds: item.seconds,
      acousticTuning: normalizeTuning(ACOUSTIC_TUNING_FIELD, item.acousticTuning),
      electricTuning: normalizeTuning(ELECTRIC_TUNING_FIELD, item.electricTuning),
      bassTuning: normalizeTuning(BASS_TUNING_FIELD, item.bassTuning),
    }));
  } catch {
    return [];
  }
}

function cloneCues(items) {
  return items.map((item) => ({ ...item }));
}

function persistCues(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
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
  const dirty = hasPendingChanges();

  saveButton.disabled = !dirty;
  clearAllButton.disabled = cues.length === 0;
  saveStatus.classList.toggle("is-dirty", dirty);

  if (saved) {
    saveStatus.textContent = "현재 순서를 로컬에 저장했습니다.";
    return;
  }

  if (dirty) {
    saveStatus.textContent = "저장되지 않은 변경사항이 있습니다. 최종 저장을 눌러 고정하세요.";
    return;
  }

  saveStatus.textContent = "현재 순서가 로컬에 저장되어 있습니다.";
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
