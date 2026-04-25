const CUES_API_ENDPOINT = "/api/cues";
const ANONYMOUS_STORAGE_KEY = "cue-sheet-anonymous-draft";
const PRACTICE_LOG_STORAGE_KEY = "cue-sheet-practice-log";
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
const practiceModal = document.querySelector("#practiceModal");
const cueModal = document.querySelector("#cueModal");
const modalTriggers = document.querySelectorAll("[data-modal-target]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");
const cueItemTemplate = document.querySelector("#cueItemTemplate");
const practiceMonthLabel = document.querySelector("#practiceMonthLabel");
const practiceMonthSummary = document.querySelector("#practiceMonthSummary");
const practiceCalendar = document.querySelector("#practiceCalendar");
const practiceMobileDateLabel = document.querySelector("#practiceMobileDateLabel");
const practiceMobileTotal = document.querySelector("#practiceMobileTotal");
const practiceJumpToFormButton = document.querySelector("#practiceJumpToFormButton");
const practicePrevMonthButton = document.querySelector("#practicePrevMonthButton");
const practiceTodayButton = document.querySelector("#practiceTodayButton");
const practiceNextMonthButton = document.querySelector("#practiceNextMonthButton");
const practiceForm = document.querySelector("#practiceForm");
const practiceDateInput = document.querySelector("#practiceDateInput");
const practiceDurationInput = document.querySelector("#practiceDurationInput");
const practiceNoteInput = document.querySelector("#practiceNoteInput");
const practiceUseCueDurationButton = document.querySelector("#practiceUseCueDurationButton");
const practiceDayLabel = document.querySelector("#practiceDayLabel");
const practiceDaySummary = document.querySelector("#practiceDaySummary");
const practiceSessionList = document.querySelector("#practiceSessionList");
const practiceEmptyState = document.querySelector("#practiceEmptyState");
const practiceEntryCard = document.querySelector("#practice-entry-card");
const cueEditorPanel = document.querySelector("#cue-editor");
const cueListPanel = document.querySelector("#cue-list-panel");

let savedCues = [];
let cues = [];
let armedDragId = null;
let activeMetronomeId = null;
let metronomeTimer = null;
let metronomeAudioContext = null;
let tapTempoClicks = [];
let measuredTapBpm = "";
let storageMode = STORAGE_MODE_LOADING;
let databaseConfigured = false;
let saveInFlight = false;
let databaseSeedRequired = false;
let storageWarningMessage = "";
let practiceLogs = {};
let selectedPracticeDate = getLocalDateKey(new Date());
let visiblePracticeMonth = startOfMonth(parseDateKey(selectedPracticeDate) || new Date());

for (const trigger of modalTriggers) {
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    openModalById(trigger.dataset.modalTarget, trigger.dataset.modalSection || "");
  });
}

for (const closeButton of modalCloseButtons) {
  closeButton.addEventListener("click", () => {
    closeModal(closeButton.closest("dialog"));
  });
}

for (const modal of [practiceModal, cueModal]) {
  if (!modal) {
    continue;
  }

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });

  modal.addEventListener("close", () => {
    syncModalState();
  });
}

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
  if (saveInFlight || storageMode !== STORAGE_MODE_DATABASE || !hasPendingChanges()) {
    return;
  }

  const password = window.prompt("저장 비밀번호를 입력하세요.");

  if (password === null) {
    return;
  }

  if (!password.trim()) {
    window.alert("비밀번호를 입력하세요.");
    return;
  }

  saveInFlight = true;
  updateActionState();

  const saveResult = await persistCurrentCues(cues, password);

  saveInFlight = false;

  if (!saveResult.ok) {
    updateActionState();
    window.alert(saveResult.message || "저장에 실패했습니다.");
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

practicePrevMonthButton.addEventListener("click", () => {
  visiblePracticeMonth = new Date(
    visiblePracticeMonth.getFullYear(),
    visiblePracticeMonth.getMonth() - 1,
    1,
  );
  renderPracticeCalendar();
});

practiceTodayButton.addEventListener("click", () => {
  const today = new Date();

  visiblePracticeMonth = startOfMonth(today);
  selectedPracticeDate = getLocalDateKey(today);
  syncPracticeInputsWithSelection();
  renderPracticeCalendar();
});

practiceNextMonthButton.addEventListener("click", () => {
  visiblePracticeMonth = new Date(
    visiblePracticeMonth.getFullYear(),
    visiblePracticeMonth.getMonth() + 1,
    1,
  );
  renderPracticeCalendar();
});

practiceDateInput.addEventListener("change", () => {
  const nextDate = normalizePracticeDateKey(practiceDateInput.value);

  if (!nextDate) {
    return;
  }

  selectedPracticeDate = nextDate;
  visiblePracticeMonth = startOfMonth(parseDateKey(nextDate) || new Date());
  renderPracticeCalendar();
});

practiceUseCueDurationButton.addEventListener("click", () => {
  const totalMinutes = Math.ceil(
    cues.reduce((sum, cue) => sum + cue.seconds, 0) / 60,
  );

  if (!totalMinutes) {
    window.alert("먼저 큐시트 항목을 추가하세요.");
    return;
  }

  practiceDurationInput.value = formatPracticeInputDuration(totalMinutes);
  practiceDurationInput.focus();
  practiceDurationInput.select();
});

practiceJumpToFormButton.addEventListener("click", () => {
  practiceEntryCard.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  window.requestAnimationFrame(() => {
    practiceDurationInput.focus();
  });
});

practiceForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const dateKey = normalizePracticeDateKey(practiceDateInput.value);
  const minutes = parsePracticeDuration(practiceDurationInput.value);
  const note = normalizePracticeNote(practiceNoteInput.value);

  if (!dateKey) {
    window.alert("연습 날짜를 선택하세요.");
    practiceDateInput.focus();
    return;
  }

  if (minutes === null || minutes <= 0) {
    window.alert("연습시간은 HH:MM 형식으로 입력하세요.");
    practiceDurationInput.focus();
    practiceDurationInput.select();
    return;
  }

  selectedPracticeDate = dateKey;
  visiblePracticeMonth = startOfMonth(parseDateKey(dateKey) || new Date());
  appendPracticeEntry(dateKey, minutes, note);
  persistPracticeLogs();
  practiceDurationInput.value = "";
  practiceNoteInput.value = "";
  syncPracticeInputsWithSelection();
  renderPracticeCalendar();
});

practiceCalendar.addEventListener("click", (event) => {
  const dayButton = event.target.closest(".practice-day");

  if (!dayButton || !dayButton.dataset.date) {
    return;
  }

  selectedPracticeDate = dayButton.dataset.date;
  syncPracticeInputsWithSelection();
  renderPracticeCalendar();
});

practiceSessionList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".practice-session-delete");

  if (!deleteButton) {
    return;
  }

  const entryId = deleteButton.dataset.entryId;

  if (!entryId) {
    return;
  }

  deletePracticeEntry(selectedPracticeDate, entryId);
  persistPracticeLogs();
  renderPracticeCalendar();
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
  initializePracticeTracker();
  render();
  updateTapTempoState();
  updateAuthUi();
  await initializeStorage();
}

async function initializeStorage() {
  storageMode = STORAGE_MODE_LOADING;
  updateAuthUi();
  updateActionState();

  const localCues = loadLocalCues();

  savedCues = cloneCues(localCues);
  cues = cloneCues(localCues);
  databaseSeedRequired = false;
  storageWarningMessage = "";
  render();

  const remoteResult = await loadRemoteCues();

  databaseConfigured = remoteResult.databaseConfigured;

  if (!remoteResult.ok) {
    storageMode = STORAGE_MODE_LOCAL;
    storageWarningMessage = remoteResult.message;
    render();
    updateActionState();
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
  persistLocalCues(remoteCues);
  render();
  updateActionState();
}

function initializePracticeTracker() {
  practiceLogs = loadPracticeLogs();
  syncPracticeInputsWithSelection();
  renderPracticeCalendar();
}

function openModalById(modalId, section = "") {
  const modal = document.querySelector(`#${modalId}`);

  if (!modal) {
    return;
  }

  if (!modal.open) {
    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "");
    }
  }

  syncModalState();

  window.requestAnimationFrame(() => {
    if (modal === cueModal) {
      focusCueModalSection(section);
      return;
    }

    if (modal === practiceModal) {
      practiceDateInput.focus();
    }
  });
}

function closeModal(modal) {
  if (!modal?.open) {
    return;
  }

  if (typeof modal.close === "function") {
    modal.close();
  } else {
    modal.removeAttribute("open");
    syncModalState();
  }
}

function syncModalState() {
  document.body.classList.toggle("has-modal-open", Boolean(document.querySelector("dialog[open]")));
}

function focusCueModalSection(section) {
  if (section === "list") {
    cueListPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  cueEditorPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  titleInput.focus();
}

function loadPracticeLogs() {
  try {
    const saved = window.localStorage.getItem(PRACTICE_LOG_STORAGE_KEY);

    if (!saved) {
      return {};
    }

    return normalizePracticeLogs(JSON.parse(saved));
  } catch {
    return {};
  }
}

function persistPracticeLogs() {
  try {
    window.localStorage.setItem(PRACTICE_LOG_STORAGE_KEY, JSON.stringify(practiceLogs));
    return true;
  } catch {
    return false;
  }
}

function normalizePracticeLogs(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized = {};

  for (const [dateKey, entries] of Object.entries(value)) {
    const nextDateKey = normalizePracticeDateKey(dateKey);
    const nextEntries = normalizePracticeEntries(entries);

    if (!nextDateKey || !nextEntries.length) {
      continue;
    }

    normalized[nextDateKey] = nextEntries;
  }

  return normalized;
}

function normalizePracticeEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => normalizePracticeEntry(entry, index))
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function normalizePracticeEntry(value, index) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const minutes = Number(value.minutes);

  if (!Number.isInteger(minutes) || minutes <= 0) {
    return null;
  }

  return {
    id: normalizePracticeEntryId(value.id, index),
    minutes,
    note: normalizePracticeNote(value.note),
    createdAt: normalizePracticeTimestamp(value.createdAt),
  };
}

function normalizePracticeEntryId(value, index) {
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 120);
  }

  return `practice-${index + 1}`;
}

function normalizePracticeTimestamp(value) {
  const createdAt = new Date(value);

  if (Number.isNaN(createdAt.getTime())) {
    return new Date().toISOString();
  }

  return createdAt.toISOString();
}

function appendPracticeEntry(dateKey, minutes, note) {
  const entries = getPracticeEntries(dateKey);

  entries.unshift({
    id: createPracticeEntryId(),
    minutes,
    note,
    createdAt: new Date().toISOString(),
  });

  practiceLogs[dateKey] = entries;
}

function deletePracticeEntry(dateKey, entryId) {
  const entries = getPracticeEntries(dateKey)
    .filter((entry) => entry.id !== entryId);

  if (entries.length) {
    practiceLogs[dateKey] = entries;
    return;
  }

  delete practiceLogs[dateKey];
}

function getPracticeEntries(dateKey) {
  return Array.isArray(practiceLogs[dateKey]) ? [...practiceLogs[dateKey]] : [];
}

function getPracticeTotalMinutes(dateKey) {
  return getPracticeEntries(dateKey)
    .reduce((sum, entry) => sum + entry.minutes, 0);
}

function renderPracticeCalendar() {
  syncPracticeInputsWithSelection();
  renderPracticeMonthGrid();
  renderPracticeSelectionSummary();
}

function renderPracticeMonthGrid() {
  const year = visiblePracticeMonth.getFullYear();
  const monthIndex = visiblePracticeMonth.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const todayKey = getLocalDateKey(new Date());
  const monthEntries = Object.entries(practiceLogs)
    .filter(([dateKey]) => dateKey.startsWith(getMonthPrefix(visiblePracticeMonth)));
  const monthMinutes = monthEntries.reduce((sum, [dateKey]) => sum + getPracticeTotalMinutes(dateKey), 0);

  practiceCalendar.innerHTML = "";
  practiceMonthLabel.textContent = `${year}년 ${monthIndex + 1}월`;
  practiceMonthSummary.textContent = `이번 달 누적 연습시간 ${formatMinutesLabel(monthMinutes)}`;

  for (let index = 0; index < firstWeekday; index += 1) {
    const placeholder = document.createElement("div");

    placeholder.className = "practice-day-empty";
    placeholder.setAttribute("aria-hidden", "true");
    practiceCalendar.appendChild(placeholder);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, monthIndex, day);
    const dateKey = getLocalDateKey(cellDate);
    const totalMinutes = getPracticeTotalMinutes(dateKey);
    const dayButton = document.createElement("button");
    const dayNumber = document.createElement("span");
    const dayTotal = document.createElement("span");

    dayButton.type = "button";
    dayButton.className = "practice-day";
    dayButton.dataset.date = dateKey;
    dayButton.classList.toggle("has-record", totalMinutes > 0);
    dayButton.classList.toggle("is-selected", dateKey === selectedPracticeDate);
    dayButton.classList.toggle("is-today", dateKey === todayKey);
    dayButton.setAttribute(
      "aria-label",
      totalMinutes
        ? `${monthIndex + 1}월 ${day}일, 연습 ${formatMinutesLabel(totalMinutes)}`
        : `${monthIndex + 1}월 ${day}일`,
    );

    dayNumber.className = "practice-day-number";
    dayNumber.textContent = String(day);
    dayTotal.className = "practice-day-total";
    dayTotal.textContent = totalMinutes ? formatMinutesClock(totalMinutes) : "기록 없음";

    dayButton.append(dayNumber, dayTotal);
    practiceCalendar.appendChild(dayButton);
  }

  const remainingCells = practiceCalendar.children.length % 7;

  if (!remainingCells) {
    return;
  }

  for (let index = remainingCells; index < 7; index += 1) {
    const placeholder = document.createElement("div");

    placeholder.className = "practice-day-empty";
    placeholder.setAttribute("aria-hidden", "true");
    practiceCalendar.appendChild(placeholder);
  }
}

function renderPracticeSelectionSummary() {
  const entries = getPracticeEntries(selectedPracticeDate);
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const summaryText = totalMinutes
    ? `${entries.length}회 기록, 총 ${formatMinutesLabel(totalMinutes)}`
    : "선택한 날짜에 기록된 연습시간이 없습니다.";

  practiceDayLabel.textContent = formatPracticeDateLabel(selectedPracticeDate);
  practiceDaySummary.textContent = summaryText;
  practiceMobileDateLabel.textContent = formatPracticeDateLabel(selectedPracticeDate);
  practiceMobileTotal.textContent = summaryText;

  practiceSessionList.innerHTML = "";
  practiceEmptyState.hidden = entries.length > 0;

  for (const entry of entries) {
    const item = document.createElement("li");
    const main = document.createElement("div");
    const duration = document.createElement("strong");
    const note = document.createElement("p");
    const meta = document.createElement("p");
    const removeButton = document.createElement("button");

    item.className = "practice-session-item";
    main.className = "practice-session-main";
    duration.className = "practice-session-duration";
    note.className = "practice-session-note";
    meta.className = "practice-session-meta";
    removeButton.className = "practice-session-delete";
    removeButton.type = "button";
    removeButton.dataset.entryId = entry.id;
    removeButton.textContent = "삭제";

    duration.textContent = formatMinutesLabel(entry.minutes);
    note.textContent = entry.note || "메모 없음";
    meta.textContent = `기록 시각 ${formatPracticeTime(entry.createdAt)}`;

    main.append(duration, note, meta);
    item.append(main, removeButton);
    practiceSessionList.appendChild(item);
  }
}

function syncPracticeInputsWithSelection() {
  practiceDateInput.value = selectedPracticeDate;
}

function parsePracticeDuration(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(":").map((part) => part.trim());

  if (parts.length !== 2 || parts.some((part) => part === "")) {
    return null;
  }

  const [hours, minutes] = parts.map(Number);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    minutes < 0 ||
    minutes >= 60
  ) {
    return null;
  }

  return (hours * 60) + minutes;
}

function formatPracticeInputDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatMinutesClock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatMinutesLabel(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}시간 ${minutes}분`;
  }

  if (hours) {
    return `${hours}시간`;
  }

  return `${minutes}분`;
}

function normalizePracticeNote(value) {
  return String(value || "").trim().slice(0, 80);
}

function normalizePracticeDateKey(value) {
  const parsedDate = parseDateKey(value);

  return parsedDate ? getLocalDateKey(parsedDate) : "";
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return null;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getMonthPrefix(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function createPracticeEntryId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `practice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatPracticeDateLabel(dateKey) {
  const date = parseDateKey(dateKey) || new Date();

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatPracticeTime(value) {
  const date = new Date(value);

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function loadLocalCues() {
  try {
    const saved = window.localStorage.getItem(ANONYMOUS_STORAGE_KEY);

    if (!saved) {
      return [];
    }

    return normalizeCueCollection(JSON.parse(saved));
  } catch {
    return [];
  }
}

function persistLocalCues(items) {
  try {
    window.localStorage.setItem(
      ANONYMOUS_STORAGE_KEY,
      JSON.stringify(normalizeCueCollection(items)),
    );
    return true;
  } catch {
    return false;
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

    if (!response.ok) {
      if (response.status === 503) {
        return {
          ok: false,
          databaseConfigured: false,
          message: "DB가 아직 연결되지 않았습니다.",
        };
      }

      return {
        ok: false,
        databaseConfigured: true,
        message: payload.message || "DB에서 큐시트를 불러오지 못했습니다.",
      };
    }

    return {
      ok: true,
      databaseConfigured: true,
      items: normalizeCueCollection(payload.items),
    };
  } catch {
    return {
      ok: false,
      databaseConfigured: true,
      message: "DB에 연결할 수 없어 로컬 캐시만 사용합니다.",
    };
  }
}

async function persistRemoteCues(items, password) {
  try {
    const response = await fetch(CUES_API_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ items, password }),
    });
    const payload = await safeReadJson(response);

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

async function persistCurrentCues(items, password) {
  const nextItems = normalizeCueCollection(items);
  const localSaved = persistLocalCues(nextItems);

  if (storageMode !== STORAGE_MODE_DATABASE) {
    return {
      ok: localSaved,
      message: localSaved ? "" : "브라우저 저장에 실패했습니다.",
    };
  }

  const remoteSaved = await persistRemoteCues(nextItems, password);

  return {
    ok: localSaved && remoteSaved.ok,
    message: remoteSaved.message || "",
  };
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
    persistLocalCues(cues);
  }

  const dirty = hasPendingChanges();
  const needsAttention = dirty || databaseSeedRequired;
  const canSaveToDatabase = storageMode === STORAGE_MODE_DATABASE;

  saveButton.disabled = !canSaveToDatabase || saveInFlight || !dirty;
  clearAllButton.disabled = storageMode === STORAGE_MODE_LOADING || saveInFlight || cues.length === 0;
  saveStatus.classList.toggle("is-dirty", needsAttention);
  saveStatus.classList.toggle(
    "is-error",
    storageMode === STORAGE_MODE_LOCAL && Boolean(storageWarningMessage),
  );

  saveButton.textContent = "목록 저장하기";

  if (storageMode === STORAGE_MODE_LOADING) {
    saveStatus.textContent = "저장 상태와 DB 연결을 확인하는 중입니다.";
    return;
  }

  if (!databaseConfigured) {
    saveStatus.textContent = "DB 연결이 아직 설정되지 않았습니다.";
    return;
  }

  if (saveInFlight) {
    saveStatus.textContent = "비밀번호를 확인한 뒤 현재 목록을 DB에 저장하는 중입니다.";
    return;
  }

  if (saved) {
    saveStatus.textContent = "현재 목록을 DB에 저장했습니다.";
    return;
  }

  if (storageMode === STORAGE_MODE_DATABASE) {
    if (databaseSeedRequired) {
      saveStatus.textContent = "공용 저장 목록이 비어 있습니다. 저장 버튼을 누르면 현재 목록을 처음 저장합니다.";
      return;
    }

    if (dirty) {
      saveStatus.textContent = "저장되지 않은 변경사항이 있습니다. 저장 버튼을 누르면 비밀번호 확인 후 반영됩니다.";
      return;
    }

    saveStatus.textContent = "현재 공용 목록이 DB에 저장되어 있습니다.";
    return;
  }

  if (dirty) {
    saveStatus.textContent = "DB 연결에 문제가 있어 현재 작업은 이 브라우저에만 남습니다.";
    return;
  }

  saveStatus.textContent = storageWarningMessage || "DB 연결에 문제가 있어 브라우저 캐시만 사용 중입니다.";
}

function updateAuthUi() {
  authTitle.textContent = "비밀번호 확인 후 저장";
  authStatus.textContent = "목록 저장 시 비밀번호를 묻습니다. 5회 연속 틀리면 '아 하지 마세요!!!'를 띄우고 카운트를 초기화합니다.";
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
