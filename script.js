const CUES_API_ENDPOINT = "/api/cues";
const PRACTICE_API_ENDPOINT = "/api/practice";
const AUTH_SESSION_ENDPOINT = "/api/auth/session";
const AUTH_GOOGLE_ENDPOINT = "/api/auth/google";
const AUTH_EMAIL_START_ENDPOINT = "/api/auth/email/start";
const AUTH_EMAIL_VERIFY_ENDPOINT = "/api/auth/email/verify";
const AUTH_LOGOUT_ENDPOINT = "/api/auth/logout";
const TODO_AUTH_ENDPOINT = "/api/todo-auth";
const TODOS_API_ENDPOINT = "/api/todos";
const ANONYMOUS_STORAGE_KEY = "cue-sheet-anonymous-draft";
const PRACTICE_LOG_STORAGE_KEY = "cue-sheet-practice-log";
const TODO_STORAGE_KEY = "cue-sheet-todo-document";
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
const CUE_TYPE_SONG = "song";
const CUE_TYPE_INTERMISSION = "intermission";
const TAP_TEMPO_RESET_MS = 2500;
const TAP_TEMPO_MAX_TAPS = 8;
const TODO_DEFAULT_HTML = `
  <h2>공연 준비</h2>
  <div class="todo-check-row">${getTodoDragHandleHtml()}<input type="checkbox"><span>필요한 할 일을 입력하세요.</span></div>
  <div class="todo-check-row">${getTodoDragHandleHtml()}<input type="checkbox"><span>체크 버튼으로 항목을 추가할 수 있습니다.</span></div>
  <p>메모, 순서, 체크리스트를 자유롭게 섞어서 정리하세요.</p>
`;
const STORAGE_MODE_LOADING = "loading";
const STORAGE_MODE_DATABASE = "database";
const STORAGE_MODE_LOCAL = "local";
const authTitle = document.querySelector("#authTitle");
const authStatus = document.querySelector("#authStatus");
const googleSignInButton = document.querySelector("#googleSignInButton");
const emailAuthForm = document.querySelector("#emailAuthForm");
const emailAuthInput = document.querySelector("#emailAuthInput");
const emailAuthCodeInput = document.querySelector("#emailAuthCodeInput");
const emailAuthCodeButton = document.querySelector("#emailAuthCodeButton");
const emailAuthVerifyButton = document.querySelector("#emailAuthVerifyButton");
const authAccount = document.querySelector("#authAccount");
const authEmailLabel = document.querySelector("#authEmailLabel");
const logoutButton = document.querySelector("#logoutButton");
const cueForm = document.querySelector("#cueForm");
const titleInput = document.querySelector("#titleInput");
const bpmInput = document.querySelector("#bpmInput");
const durationMinutesInput = document.querySelector("#durationMinutesInput");
const durationSecondsInput = document.querySelector("#durationSecondsInput");
const openCueEntryButton = document.querySelector("#openCueEntryButton");
const addIntermissionButton = document.querySelector("#addIntermissionButton");
const cueEntryOverlay = document.querySelector("#cueEntryOverlay");
const cueEntryTitle = document.querySelector("#cueEntryTitle");
const titleFieldLabel = document.querySelector("#titleFieldLabel");
const bpmField = document.querySelector("#bpmField");
const cueEntrySubmitButton = document.querySelector("#cueEntrySubmitButton");
const cueEntryCloseButtons = document.querySelectorAll("[data-cue-entry-close]");
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
const todoModal = document.querySelector("#todoModal");
const modalTriggers = document.querySelectorAll("[data-modal-target]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");
const todoEditor = document.querySelector("#todoEditor");
const todoStatus = document.querySelector("#todoStatus");
const todoLockForm = document.querySelector("#todoLockForm");
const todoPasswordInput = document.querySelector("#todoPasswordInput");
const todoUnlockButton = document.querySelector("#todoUnlockButton");
const todoToolbarButtons = document.querySelectorAll("[data-todo-command]");
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
let authSession = {
  authenticated: false,
  email: "",
  databaseConfigured: false,
  googleLoginConfigured: false,
  emailLoginConfigured: false,
  googleClientId: "",
};
let authInFlight = false;
let emailAuthInFlight = false;
let authNotice = "";
let googleButtonRenderedForClientId = "";
let googleButtonRenderRetry = 0;
let cueInteractDragState = null;
let cueInteractInitialized = false;
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
let practiceStorageMode = STORAGE_MODE_LOADING;
let practiceRemoteSeedRequired = false;
let practiceWarningMessage = "";
let practiceLogs = {};
let selectedPracticeDate = getLocalDateKey(new Date());
let visiblePracticeMonth = startOfMonth(parseDateKey(selectedPracticeDate) || new Date());
let cueEntryMode = CUE_TYPE_SONG;
let cueEntryRestoreTarget = openCueEntryButton;
let todoSaveTimer = null;
let todoSelectionRange = null;
let todoInteractDragState = null;
let todoInteractInitialized = false;
let todoEditUnlocked = false;
let todoUnlockInFlight = false;
let todoEditPassword = "";
let todoSaveInFlight = false;
let todoPendingSave = false;
let todoLastSavedHtml = "";
let todoNeedsInitialDbSave = false;

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

for (const modal of [practiceModal, cueModal, todoModal]) {
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

for (const button of todoToolbarButtons) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });

  button.addEventListener("click", () => {
    handleTodoCommand(button.dataset.todoCommand);
  });
}

todoLockForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockTodoEditor();
});

document.addEventListener("selectionchange", () => {
  saveTodoSelection();
});

todoEditor?.addEventListener("input", () => {
  if (!requireTodoEditAccess()) {
    return;
  }

  saveTodoSelection();
  scheduleTodoSave();
});

todoEditor?.addEventListener("change", (event) => {
  if (event.target.matches(".todo-check-row input")) {
    if (!requireTodoEditAccess()) {
      event.preventDefault();
      event.target.checked = event.target.hasAttribute("checked");
      return;
    }

    syncTodoCheckboxAttribute(event.target);
    saveTodoDocument();
  }
});

todoEditor?.addEventListener("paste", (event) => {
  event.preventDefault();

  if (!requireTodoEditAccess()) {
    return;
  }

  insertTodoText(event.clipboardData?.getData("text/plain") || "");
});

todoEditor?.addEventListener("keydown", (event) => {
  if (!todoEditUnlocked) {
    if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      requireTodoEditAccess();
    }

    return;
  }

  if (!(event.metaKey || event.ctrlKey)) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === "a") {
    event.preventDefault();
    selectTodoEditorContents();
    return;
  }

  if (key === "s") {
    event.preventDefault();
    saveTodoDocument();
  }
});

todoEditor?.addEventListener("contextmenu", (event) => {
  if (todoInteractDragState) {
    event.preventDefault();
  }
});

openCueEntryButton?.addEventListener("click", () => {
  openCueEntryOverlay({
    type: CUE_TYPE_SONG,
    restoreTarget: openCueEntryButton,
  });
});

addIntermissionButton?.addEventListener("click", () => {
  openCueEntryOverlay({
    type: CUE_TYPE_INTERMISSION,
    restoreTarget: addIntermissionButton,
  });
});

for (const closeButton of cueEntryCloseButtons) {
  closeButton.addEventListener("click", () => {
    closeCueEntryOverlay();
  });
}

cueEntryOverlay?.addEventListener("click", (event) => {
  if (event.target === cueEntryOverlay) {
    closeCueEntryOverlay();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cueEntryOverlay && !cueEntryOverlay.hidden) {
    event.preventDefault();
    closeCueEntryOverlay();
  }
});

window.addEventListener("load", () => {
  renderGoogleSignInButton();
});

window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;


logoutButton?.addEventListener("click", async () => {
  await logoutAuthSession();
});

emailAuthForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  requestEmailAuthCode();
});

emailAuthVerifyButton?.addEventListener("click", () => {
  verifyEmailAuthCode();
});

emailAuthCodeInput?.addEventListener("input", () => {
  emailAuthCodeInput.value = emailAuthCodeInput.value.replace(/\D/g, "").slice(0, 6);
});

cueForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const completedEntryMode = cueEntryMode;

  if (!appendCueFromForm()) {
    return;
  }

  closeCueEntryOverlay({ restoreFocus: false, resetForm: false });
  cueForm.reset();
  (completedEntryMode === CUE_TYPE_INTERMISSION ? addIntermissionButton : openCueEntryButton)?.focus();
});

saveButton.addEventListener("click", async () => {
  if (saveInFlight || storageMode !== STORAGE_MODE_DATABASE || !hasPendingChanges()) {
    return;
  }

  let password = "";

  if (!authSession.authenticated) {
    password = window.prompt("저장 비밀번호를 입력하세요.");

    if (password === null) {
      return;
    }

    if (!password.trim()) {
      window.alert("비밀번호를 입력하세요.");
      return;
    }
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

  openCueEntryOverlay({
    resetForm: false,
    type: CUE_TYPE_SONG,
    restoreTarget: openCueEntryButton,
  });

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

practiceForm.addEventListener("submit", async (event) => {
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
  const nextLogs = appendPracticeEntry(practiceLogs, dateKey, minutes, note);
  const saveResult = await commitPracticeLogs(nextLogs);

  if (!saveResult.ok) {
    if (!saveResult.cancelled) {
      window.alert(saveResult.message || "연습 캘린더 저장에 실패했습니다.");
    }
    return;
  }

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

practiceSessionList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".practice-session-delete");

  if (!deleteButton) {
    return;
  }

  const entryId = deleteButton.dataset.entryId;

  if (!entryId) {
    return;
  }

  const nextLogs = deletePracticeEntry(practiceLogs, selectedPracticeDate, entryId);
  const saveResult = await commitPracticeLogs(nextLogs);

  if (!saveResult.ok) {
    if (!saveResult.cancelled) {
      window.alert(saveResult.message || "연습 기록 삭제에 실패했습니다.");
    }
    return;
  }

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

  syncCueBpmControls(item, nextBpm);
  cue.bpm = nextBpm;

  if (activeMetronomeId === item.dataset.id) {
    rescheduleMetronome();
  }

  updateActionState();
});

cueList.addEventListener("click", (event) => {
  const menuButton = event.target.closest(".cue-menu-button");

  if (menuButton) {
    const activeMenu = menuButton.closest(".cue-mobile-actions");

    window.setTimeout(() => {
      for (const menu of cueList.querySelectorAll(".cue-mobile-actions[open]")) {
        if (menu !== activeMenu) {
          menu.removeAttribute("open");
        }
      }
    }, 0);

    return;
  }

  const metronomeButton = event.target.closest(".metronome-button");

  if (metronomeButton) {
    const item = metronomeButton.closest(".cue-item");

    if (item) {
      toggleMetronome(item.dataset.id);
    }

    return;
  }

  const moveButton = event.target.closest(".cue-move-button");

  if (moveButton) {
    const item = moveButton.closest(".cue-item");

    if (!item) {
      return;
    }

    moveCue(item.dataset.id, moveButton.dataset.direction === "up" ? -1 : 1);
    closeCueMobileMenu(item);
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
  syncCueTuningControls(item, field, nextValue);
  updateActionState();
});

cueList.addEventListener("contextmenu", (event) => {
  if (cueInteractDragState) {
    event.preventDefault();
  }
});

setupCueInteractDrag();
setupTodoInteractDrag();

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
  await loadTodoDocument();
  render();
  updateTapTempoState();
  updateAuthUi();
  await initializeAuth();
  await Promise.all([
    initializePracticeTracker(),
    initializeStorage(),
  ]);
}

async function initializeAuth() {
  authSession = await loadAuthSession();
  authNotice = "";
  updateAuthUi();
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

async function initializePracticeTracker() {
  const localLogs = loadPracticeLogs();

  practiceLogs = clonePracticeLogs(localLogs);
  practiceStorageMode = STORAGE_MODE_LOCAL;
  practiceRemoteSeedRequired = false;
  practiceWarningMessage = "";
  syncPracticeInputsWithSelection();
  renderPracticeCalendar();

  const remoteResult = await loadRemotePracticeLogs();

  if (!remoteResult.ok) {
    practiceStorageMode = STORAGE_MODE_LOCAL;
    practiceWarningMessage = remoteResult.message;
    renderPracticeCalendar();
    return;
  }

  practiceStorageMode = STORAGE_MODE_DATABASE;
  practiceWarningMessage = "";

  if (!hasPracticeLogData(remoteResult.logs) && hasPracticeLogData(localLogs)) {
    practiceLogs = clonePracticeLogs(localLogs);
    practiceRemoteSeedRequired = true;
    renderPracticeCalendar();
    return;
  }

  practiceRemoteSeedRequired = false;
  practiceLogs = clonePracticeLogs(remoteResult.logs);
  persistPracticeLogs();
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
      return;
    }

    if (modal === todoModal) {
      if (!todoEditUnlocked) {
        todoPasswordInput?.focus();
        return;
      }

      focusTodoEditor();
    }
  });
}

function closeModal(modal) {
  if (!modal?.open) {
    return;
  }

  if (modal === cueModal) {
    closeCueEntryOverlay({ restoreFocus: false });
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
  openCueEntryButton?.focus();
}

async function loadTodoDocument() {
  if (!todoEditor) {
    return;
  }

  updateTodoStatus("DB에서 할 일 목록을 불러오는 중...");

  const localHtml = readLegacyTodoDocument();

  try {
    const response = await fetch(TODOS_API_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      throw new Error(payload.message || "DB에서 할 일 목록을 불러오지 못했습니다.");
    }

    const remoteHtml = typeof payload.html === "string" ? payload.html : "";
    const nextHtml = remoteHtml || localHtml || TODO_DEFAULT_HTML.trim();

    todoEditor.innerHTML = nextHtml;
    todoLastSavedHtml = remoteHtml;
    todoNeedsInitialDbSave = !remoteHtml && Boolean(localHtml);
    normalizeTodoCheckboxes();
    syncTodoEditAccess({ updateStatus: false });
    updateTodoStatus(todoNeedsInitialDbSave
      ? "기존 로컬 할 일을 불러왔습니다. 비밀번호 입력 후 DB에 저장됩니다."
      : "비밀번호 입력 후 편집할 수 있습니다.");
  } catch {
    todoEditor.innerHTML = localHtml || TODO_DEFAULT_HTML.trim();
    todoLastSavedHtml = "";
    todoNeedsInitialDbSave = false;
    normalizeTodoCheckboxes();
    syncTodoEditAccess({ updateStatus: false });
    updateTodoStatus(localHtml
      ? "DB 연결에 실패해 이 브라우저의 로컬 할 일을 표시합니다."
      : "DB 연결에 실패했습니다. 비밀번호 입력 후에도 저장되지 않을 수 있습니다.");
  }
}

function readLegacyTodoDocument() {
  try {
    return window.localStorage.getItem(TODO_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function clearLegacyTodoDocument() {
  try {
    window.localStorage.removeItem(TODO_STORAGE_KEY);
  } catch {
    // DB is now the source of truth; local cleanup is best effort.
  }
}

async function unlockTodoEditor() {
  if (!todoPasswordInput || todoUnlockInFlight) {
    return;
  }

  const password = todoPasswordInput.value.trim();

  if (!password) {
    updateTodoStatus("비밀번호를 입력하세요.");
    todoPasswordInput.focus();
    return;
  }

  todoUnlockInFlight = true;
  syncTodoEditAccess({ updateStatus: false });
  updateTodoStatus("비밀번호 확인 중...");

  try {
    const response = await fetch(TODO_AUTH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      updateTodoStatus(payload.message || "비밀번호가 맞지 않습니다.");
      todoPasswordInput.select();
      return;
    }

    todoEditUnlocked = true;
    todoEditPassword = password;
    todoPasswordInput.value = "";
    updateTodoStatus("편집 가능합니다.");
  } catch {
    updateTodoStatus("비밀번호 확인을 완료하지 못했습니다.");
  } finally {
    todoUnlockInFlight = false;
    syncTodoEditAccess({ updateStatus: false });

    if (todoEditUnlocked) {
      focusTodoEditor();
      if (todoNeedsInitialDbSave) {
        saveTodoDocument();
      }
    } else {
      todoPasswordInput.focus();
    }
  }
}

function requireTodoEditAccess() {
  if (todoEditUnlocked) {
    return true;
  }

  updateTodoStatus("비밀번호 입력 후 편집할 수 있습니다.");
  todoPasswordInput?.focus();
  return false;
}

function syncTodoEditAccess({ updateStatus = true } = {}) {
  const locked = !todoEditUnlocked;

  if (todoEditor) {
    todoEditor.classList.toggle("is-locked", locked);
    todoEditor.setAttribute("contenteditable", locked ? "false" : "true");
    todoEditor.setAttribute("aria-readonly", locked ? "true" : "false");

    for (const checkbox of todoEditor.querySelectorAll('.todo-check-row input[type="checkbox"]')) {
      checkbox.disabled = locked;
    }

    for (const handle of todoEditor.querySelectorAll(".todo-check-drag-handle")) {
      handle.disabled = locked;
    }
  }

  if (todoLockForm) {
    todoLockForm.hidden = !locked;
  }

  if (todoPasswordInput) {
    todoPasswordInput.disabled = todoUnlockInFlight;
  }

  if (todoUnlockButton) {
    todoUnlockButton.disabled = todoUnlockInFlight;
  }

  for (const button of todoToolbarButtons) {
    button.disabled = locked;
  }

  if (updateStatus) {
    updateTodoStatus(locked ? "비밀번호 입력 후 편집할 수 있습니다." : "DB에 자동 저장됩니다.");
  }
}

function handleTodoCommand(command) {
  if (!todoEditor) {
    return;
  }

  if (!requireTodoEditAccess()) {
    return;
  }

  restoreTodoSelection();
  focusTodoEditor();

  if (command === "heading") {
    insertTodoHtml("<h2>제목</h2><p><br></p>");
  } else if (command === "check") {
    insertTodoCheckRow();
  } else if (command === "bullet") {
    insertTodoHtml("<ul><li>항목</li></ul><p><br></p>");
  } else if (command === "divider") {
    insertTodoHtml("<hr><p><br></p>");
  } else if (command === "clear") {
    if (!window.confirm("할 일 목록을 초기화할까요?")) {
      return;
    }

    todoEditor.innerHTML = TODO_DEFAULT_HTML.trim();
    normalizeTodoCheckboxes();
  }

  saveTodoDocument();
  saveTodoSelection();
}

function getTodoDragHandleHtml() {
  return [
    '<button class="todo-check-drag-handle" type="button" draggable="false" contenteditable="false" aria-label="할 일 순서 이동" title="드래그하여 순서 이동">',
    '<span class="todo-drag-dots" aria-hidden="true"><span></span><span></span><span></span></span>',
    "</button>",
  ].join("");
}

function insertTodoCheckRow() {
  const html = `<div class="todo-check-row">${getTodoDragHandleHtml()}<input type="checkbox"><span>새 할 일</span></div><p><br></p>`;
  const activeCheckRow = getActiveTodoCheckRow();
  const nodes = htmlToNodes(html);
  const firstNode = nodes[0];

  if (!activeCheckRow) {
    insertTodoHtmlAtSelection(nodes);
    selectTodoNodeText(firstNode);
    return;
  }

  activeCheckRow.after(...nodes);
  selectTodoNodeText(firstNode);
}

function insertTodoHtmlAtSelection(nodes) {
  const selection = window.getSelection();

  if (!selection || !selection.rangeCount || !todoEditor.contains(selection.anchorNode)) {
    todoEditor.append(...nodes);
    return;
  }

  const range = selection.getRangeAt(0);
  const lastNode = nodes[nodes.length - 1];

  range.deleteContents();

  for (const node of nodes) {
    range.insertNode(node);
    range.setStartAfter(node);
  }

  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function getActiveTodoCheckRow() {
  const selection = window.getSelection();

  if (!selection?.rangeCount || !todoEditor.contains(selection.anchorNode)) {
    return null;
  }

  const anchor = selection.anchorNode.nodeType === Node.ELEMENT_NODE
    ? selection.anchorNode
    : selection.anchorNode.parentElement;
  const checkRow = anchor?.closest?.(".todo-check-row");

  return checkRow && todoEditor.contains(checkRow) ? checkRow : null;
}

function selectTodoNodeText(node) {
  const target = node?.querySelector?.("span") || node;

  if (!target) {
    return;
  }

  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();

  todoEditor.focus();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
  saveTodoSelection();
}

function selectTodoEditorContents() {
  if (!todoEditor) {
    return;
  }

  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  const range = document.createRange();

  todoEditor.focus();
  range.selectNodeContents(todoEditor);
  selection.removeAllRanges();
  selection.addRange(range);
  saveTodoSelection();
}

function saveTodoSelection() {
  if (!todoEditor) {
    return;
  }

  const selection = window.getSelection();

  if (!selection?.rangeCount || !todoEditor.contains(selection.anchorNode)) {
    return;
  }

  todoSelectionRange = selection.getRangeAt(0).cloneRange();
}

function restoreTodoSelection() {
  if (!todoSelectionRange || !todoEditor) {
    return;
  }

  const selection = window.getSelection();

  if (!selection) {
    return;
  }

  todoEditor.focus();
  selection.removeAllRanges();
  selection.addRange(todoSelectionRange.cloneRange());
}

function focusTodoEditor() {
  if (!todoEditor) {
    return;
  }

  todoEditor.focus();

  if (!todoEditor.textContent.trim()) {
    return;
  }

  const selection = window.getSelection();

  if (selection?.rangeCount && todoEditor.contains(selection.anchorNode)) {
    return;
  }

  if (!selection) {
    return;
  }

  const range = document.createRange();

  range.selectNodeContents(todoEditor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertTodoText(text) {
  if (!todoEditor) {
    return;
  }

  if (!requireTodoEditAccess()) {
    return;
  }

  const safeText = String(text || "");
  const html = safeText
    .split(/\r?\n/)
    .map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>")
    .join("");

  insertTodoHtml(html || "<p><br></p>");
  saveTodoDocument();
}

function insertTodoHtml(html) {
  const nodes = htmlToNodes(html);

  insertTodoHtmlAtSelection(nodes);
}

function htmlToNodes(html) {
  const template = document.createElement("template");

  template.innerHTML = html;

  return Array.from(template.content.childNodes);
}

function scheduleTodoSave() {
  updateTodoStatus("DB 저장 대기 중...");
  window.clearTimeout(todoSaveTimer);
  todoSaveTimer = window.setTimeout(() => {
    saveTodoDocument();
  }, 350);
}

async function saveTodoDocument() {
  if (!todoEditor) {
    return;
  }

  if (!todoEditUnlocked) {
    return;
  }

  normalizeTodoCheckboxes();
  syncTodoEditAccess({ updateStatus: false });
  const html = todoEditor.innerHTML;

  if (html === todoLastSavedHtml && !todoNeedsInitialDbSave) {
    updateTodoStatus("DB 저장됨");
    return;
  }

  if (!todoEditPassword) {
    todoEditUnlocked = false;
    syncTodoEditAccess({ updateStatus: false });
    updateTodoStatus("비밀번호 입력 후 저장할 수 있습니다.");
    todoPasswordInput?.focus();
    return;
  }

  if (todoSaveInFlight) {
    todoPendingSave = true;
    return;
  }

  todoSaveInFlight = true;
  updateTodoStatus("DB에 저장 중...");

  try {
    const response = await fetch(TODOS_API_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        password: todoEditPassword,
      }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      if (response.status === 401 || response.status === 429) {
        todoEditUnlocked = false;
        todoEditPassword = "";
        syncTodoEditAccess({ updateStatus: false });
      }

      updateTodoStatus(payload.message || "DB에 저장하지 못했습니다.");
      return;
    }

    todoLastSavedHtml = typeof payload.html === "string" ? payload.html : html;
    todoNeedsInitialDbSave = false;
    clearLegacyTodoDocument();
    updateTodoStatus("DB 저장됨");
  } catch {
    updateTodoStatus("DB에 저장하지 못했습니다.");
  } finally {
    todoSaveInFlight = false;

    if (todoPendingSave) {
      todoPendingSave = false;
      saveTodoDocument();
    }
  }
}

function normalizeTodoCheckboxes() {
  if (!todoEditor) {
    return;
  }

  for (const row of todoEditor.querySelectorAll(".todo-check-row")) {
    normalizeTodoCheckRow(row);
  }
}

function normalizeTodoCheckRow(row) {
  if (!row.querySelector(".todo-check-drag-handle")) {
    row.insertAdjacentHTML("afterbegin", getTodoDragHandleHtml());
  }

  const handle = row.querySelector(".todo-check-drag-handle");
  const checkbox = row.querySelector('input[type="checkbox"]');
  const text = [...row.querySelectorAll("span")]
    .find((span) => !span.closest(".todo-check-drag-handle"));

  handle?.setAttribute("contenteditable", "false");
  handle?.setAttribute("draggable", "false");
  checkbox?.setAttribute("contenteditable", "false");

  if (checkbox) {
    syncTodoCheckboxAttribute(checkbox);
  }

  if (text && !text.textContent.trim()) {
    text.textContent = "새 할 일";
  }
}

function syncTodoCheckboxAttribute(checkbox) {
  if (checkbox.checked) {
    checkbox.setAttribute("checked", "");
    return;
  }

  checkbox.removeAttribute("checked");
}

function updateTodoStatus(message) {
  if (todoStatus) {
    todoStatus.textContent = message;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function openCueEntryOverlay(options = {}) {
  const {
    resetForm = true,
    type = CUE_TYPE_SONG,
    restoreTarget = openCueEntryButton,
  } = options;

  if (!cueEntryOverlay) {
    return;
  }

  if (!cueModal?.open) {
    openModalById("cueModal", "input");
  }

  if (resetForm) {
    cueForm.reset();
  }

  cueEntryMode = type === CUE_TYPE_INTERMISSION ? CUE_TYPE_INTERMISSION : CUE_TYPE_SONG;
  cueEntryRestoreTarget = restoreTarget;
  syncCueEntryMode({ resetForm });

  cueEntryOverlay.hidden = false;
  window.requestAnimationFrame(() => {
    if (cueEntryMode === CUE_TYPE_INTERMISSION) {
      durationMinutesInput.focus();
      return;
    }

    titleInput.focus();
  });
}

function closeCueEntryOverlay(options = {}) {
  const { restoreFocus = true, resetForm = true } = options;

  if (!cueEntryOverlay || cueEntryOverlay.hidden) {
    return;
  }

  cueEntryOverlay.hidden = true;

  if (resetForm) {
    cueForm.reset();
  }

  if (restoreFocus) {
    cueEntryRestoreTarget?.focus();
  }
}

function syncCueEntryMode({ resetForm = false } = {}) {
  const isIntermission = cueEntryMode === CUE_TYPE_INTERMISSION;

  if (cueEntryTitle) {
    cueEntryTitle.textContent = isIntermission ? "구분선 추가" : "항목 추가";
  }

  if (titleFieldLabel) {
    titleFieldLabel.textContent = isIntermission ? "구분선 제목" : "멘트";
  }

  titleInput.placeholder = isIntermission ? "예: 인터미션" : "예: 오프닝 멘트";
  bpmField.hidden = isIntermission;
  bpmInput.disabled = isIntermission;

  if (cueEntrySubmitButton) {
    cueEntrySubmitButton.textContent = isIntermission ? "구분선 추가" : "추가";
  }

  if (isIntermission) {
    bpmInput.value = "";

    if (resetForm) {
      titleInput.value = "인터미션";
      durationSecondsInput.value = "0";
    }
  }
}

function appendCueFromForm() {
  const title = titleInput.value.trim();
  const seconds = parseDurationInputs();
  const isIntermission = cueEntryMode === CUE_TYPE_INTERMISSION;

  if (!title) {
    titleInput.focus();
    return false;
  }

  if (seconds === null) {
    alert("시간을 올바르게 입력하세요. 초는 0부터 59까지 입력할 수 있습니다.");
    durationMinutesInput.focus();
    durationMinutesInput.select();
    return false;
  }

  cues.push({
    id: createCueId(),
    type: isIntermission ? CUE_TYPE_INTERMISSION : CUE_TYPE_SONG,
    title,
    bpm: isIntermission ? "" : normalizeBpm(bpmInput.value),
    seconds,
    acousticTuning: TUNING_STANDARD,
    electricTuning: TUNING_STANDARD,
    bassTuning: TUNING_STANDARD,
  });

  render();
  return true;
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

async function loadRemotePracticeLogs() {
  try {
    const response = await fetch(PRACTICE_API_ENDPOINT, {
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
          message: "DB가 아직 연결되지 않아 연습 기록은 로컬 캐시만 사용합니다.",
        };
      }

      return {
        ok: false,
        message: payload.message || "DB에서 연습 기록을 불러오지 못했습니다.",
      };
    }

    return {
      ok: true,
      logs: normalizePracticeLogs(payload.logs),
    };
  } catch {
    return {
      ok: false,
      message: "DB에 연결할 수 없어 연습 기록은 로컬 캐시만 사용합니다.",
    };
  }
}

async function persistRemotePracticeLogs(logs, password) {
  try {
    const response = await fetch(PRACTICE_API_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        logs,
        password,
      }),
    });
    const payload = await safeReadJson(response);

    return {
      ok: response.ok,
      message: payload.message || "",
    };
  } catch {
    return {
      ok: false,
      message: "연습 기록 저장 요청을 완료하지 못했습니다.",
    };
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

function clonePracticeLogs(logs) {
  return normalizePracticeLogs(logs);
}

function hasPracticeLogData(logs) {
  return Object.values(normalizePracticeLogs(logs))
    .some((entries) => entries.length > 0);
}

function appendPracticeEntry(logs, dateKey, minutes, note) {
  const nextLogs = clonePracticeLogs(logs);
  const entries = getPracticeEntries(dateKey, nextLogs);

  entries.unshift({
    id: createPracticeEntryId(),
    minutes,
    note,
    createdAt: new Date().toISOString(),
  });

  nextLogs[dateKey] = entries;
  return nextLogs;
}

function deletePracticeEntry(logs, dateKey, entryId) {
  const nextLogs = clonePracticeLogs(logs);
  const entries = getPracticeEntries(dateKey, nextLogs)
    .filter((entry) => entry.id !== entryId);

  if (entries.length) {
    nextLogs[dateKey] = entries;
    return nextLogs;
  }

  delete nextLogs[dateKey];
  return nextLogs;
}

function getPracticeEntries(dateKey, logs = practiceLogs) {
  return Array.isArray(logs[dateKey]) ? logs[dateKey].map((entry) => ({ ...entry })) : [];
}

function getPracticeTotalMinutes(dateKey, logs = practiceLogs) {
  return getPracticeEntries(dateKey, logs)
    .reduce((sum, entry) => sum + entry.minutes, 0);
}

async function commitPracticeLogs(nextLogs) {
  const normalizedLogs = clonePracticeLogs(nextLogs);

  if (practiceStorageMode !== STORAGE_MODE_DATABASE && !practiceRemoteSeedRequired) {
    practiceLogs = normalizedLogs;
    persistPracticeLogs();
    return {
      ok: true,
      localOnly: true,
    };
  }

  const password = window.prompt("연습 캘린더 저장 비밀번호를 입력하세요.");

  if (password === null) {
    return {
      ok: false,
      cancelled: true,
    };
  }

  if (!password.trim()) {
    return {
      ok: false,
      message: "비밀번호를 입력하세요.",
    };
  }

  const remoteSaved = await persistRemotePracticeLogs(normalizedLogs, password);

  if (!remoteSaved.ok) {
    return {
      ok: false,
      message: remoteSaved.message || "연습 캘린더 저장에 실패했습니다.",
    };
  }

  practiceStorageMode = STORAGE_MODE_DATABASE;
  practiceRemoteSeedRequired = false;
  practiceWarningMessage = "";
  practiceLogs = normalizedLogs;
  persistPracticeLogs();

  return {
    ok: true,
  };
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
  const summaryParts = [`이번 달 누적 연습시간 ${formatMinutesLabel(monthMinutes)}`];

  practiceCalendar.innerHTML = "";
  practiceMonthLabel.textContent = `${year}년 ${monthIndex + 1}월`;

  if (practiceRemoteSeedRequired) {
    summaryParts.push("다음 저장 때 DB로 올립니다.");
  } else if (practiceStorageMode === STORAGE_MODE_LOCAL && practiceWarningMessage) {
    summaryParts.push("현재 로컬 캐시 사용 중");
  }

  practiceMonthSummary.textContent = summaryParts.join(" · ");

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

async function loadAuthSession() {
  try {
    const response = await fetch(AUTH_SESSION_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await safeReadJson(response);

    return normalizeAuthSession(payload);
  } catch {
    return {
      authenticated: false,
      email: "",
      databaseConfigured: false,
      googleLoginConfigured: false,
      emailLoginConfigured: false,
      googleClientId: "",
      message: "로그인 상태를 확인하지 못했습니다.",
    };
  }
}

async function handleGoogleCredentialResponse(googleResponse) {
  if (authInFlight) {
    return;
  }

  const credential = String(googleResponse?.credential || "");

  if (!credential) {
    authNotice = "Google 로그인 응답을 확인하지 못했습니다.";
    updateAuthUi();
    return;
  }

  authInFlight = true;
  authNotice = "Google 로그인을 확인하는 중입니다.";
  updateAuthUi();

  try {
    const response = await fetch(AUTH_GOOGLE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ credential }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      authNotice = payload.message || "Google 로그인에 실패했습니다.";
      return;
    }

    authSession = normalizeAuthSession({
      ...payload,
      databaseConfigured: true,
      googleLoginConfigured: true,
      emailLoginConfigured: authSession.emailLoginConfigured,
      googleClientId: authSession.googleClientId,
    });
    authNotice = "로그인되었습니다.";
    await initializeStorage();
  } catch {
    authNotice = "로그인 처리를 완료하지 못했습니다.";
  } finally {
    authInFlight = false;
    updateAuthUi();
  }
}

async function requestEmailAuthCode() {
  if (emailAuthInFlight || authSession.authenticated) {
    return;
  }

  const email = normalizeEmail(emailAuthInput?.value || "");

  if (!isValidEmail(email)) {
    authNotice = "이메일 주소를 확인해 주세요.";
    updateAuthUi();
    emailAuthInput?.focus();
    return;
  }

  emailAuthInFlight = true;
  authNotice = "인증코드를 보내는 중입니다.";
  updateAuthUi();

  try {
    const response = await fetch(AUTH_EMAIL_START_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      authNotice = payload.message || "인증코드를 보내지 못했습니다.";
      return;
    }

    emailAuthInput.value = email;
    emailAuthCodeInput.value = "";
    authNotice = "인증코드를 보냈습니다. 메일함을 확인해 주세요.";
    emailAuthCodeInput?.focus();
  } catch {
    authNotice = "인증코드를 보내지 못했습니다.";
  } finally {
    emailAuthInFlight = false;
    updateAuthUi();
  }
}

async function verifyEmailAuthCode() {
  if (emailAuthInFlight || authSession.authenticated) {
    return;
  }

  const email = normalizeEmail(emailAuthInput?.value || "");
  const code = String(emailAuthCodeInput?.value || "").replace(/\D/g, "").slice(0, 6);

  if (!isValidEmail(email) || code.length !== 6) {
    authNotice = "이메일과 6자리 인증코드를 확인해 주세요.";
    updateAuthUi();
    (isValidEmail(email) ? emailAuthCodeInput : emailAuthInput)?.focus();
    return;
  }

  emailAuthInFlight = true;
  authNotice = "인증코드를 확인하는 중입니다.";
  updateAuthUi();

  try {
    const response = await fetch(AUTH_EMAIL_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, code }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      authNotice = payload.message || "이메일 인증에 실패했습니다.";
      return;
    }

    authSession = normalizeAuthSession({
      ...payload,
      databaseConfigured: true,
      googleLoginConfigured: authSession.googleLoginConfigured,
      emailLoginConfigured: authSession.emailLoginConfigured,
      googleClientId: authSession.googleClientId,
    });
    emailAuthCodeInput.value = "";
    authNotice = "로그인되었습니다.";
    await initializeStorage();
  } catch {
    authNotice = "이메일 인증을 완료하지 못했습니다.";
  } finally {
    emailAuthInFlight = false;
    updateAuthUi();
  }
}

async function logoutAuthSession() {
  if (authInFlight) {
    return;
  }

  if (hasPendingChanges()) {
    const confirmed = window.confirm("저장되지 않은 변경사항이 있습니다. 로그아웃하시겠습니까?");

    if (!confirmed) {
      return;
    }
  }

  authInFlight = true;
  authNotice = "로그아웃하는 중입니다.";
  updateAuthUi();

  try {
    await fetch(AUTH_LOGOUT_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });

    authSession = {
      authenticated: false,
      email: "",
      databaseConfigured: authSession.databaseConfigured,
      googleLoginConfigured: authSession.googleLoginConfigured,
      emailLoginConfigured: authSession.emailLoginConfigured,
      googleClientId: authSession.googleClientId,
    };
    authNotice = "로그아웃되었습니다.";
    window.google?.accounts?.id?.disableAutoSelect();
    await initializeStorage();
  } catch {
    authNotice = "로그아웃 요청을 완료하지 못했습니다.";
  } finally {
    authInFlight = false;
    updateAuthUi();
  }
}

function normalizeAuthSession(value) {
  return {
    authenticated: Boolean(value?.authenticated),
    email: normalizeEmail(value?.email),
    databaseConfigured: Boolean(value?.databaseConfigured),
    googleLoginConfigured: Boolean(value?.googleLoginConfigured),
    emailLoginConfigured: Boolean(value?.emailLoginConfigured),
    googleClientId: String(value?.googleClientId || "").trim(),
    message: typeof value?.message === "string" ? value.message : "",
  };
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

  const type = item.type === CUE_TYPE_INTERMISSION ? CUE_TYPE_INTERMISSION : CUE_TYPE_SONG;
  const title = typeof item.title === "string" ? item.title.trim() : "";

  if (type === CUE_TYPE_INTERMISSION) {
    const seconds = Number(item.seconds);

    return {
      id: normalizeCueId(item.id, index),
      type,
      title: title.slice(0, 60) || "인터미션",
      bpm: "",
      seconds: Number.isInteger(seconds) && seconds >= 0 ? seconds : 0,
      acousticTuning: TUNING_STANDARD,
      electricTuning: TUNING_STANDARD,
      bassTuning: TUNING_STANDARD,
    };
  }

  const seconds = Number(item.seconds);

  if (!title || !Number.isInteger(seconds) || seconds < 0) {
    return null;
  }

  return {
    id: normalizeCueId(item.id, index),
    type,
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

  for (const [index, cue] of cues.entries()) {
    const fragment = cueItemTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".cue-item");
    const title = fragment.querySelector(".cue-title");
    const bpmListInputs = fragment.querySelectorAll(".bpm-list-input");
    const duration = fragment.querySelector(".cue-duration");
    const mobileDuration = fragment.querySelector(".cue-mobile-duration-value");
    const tuningSelects = fragment.querySelectorAll(".tuning-select");
    const moveButtons = fragment.querySelectorAll(".cue-move-button");
    const isIntermission = cue.type === CUE_TYPE_INTERMISSION;

    title.textContent = cue.title;
    item.classList.toggle("cue-item-intermission", isIntermission);
    item.dataset.type = cue.type;

    for (const bpmListInput of bpmListInputs) {
      bpmListInput.value = normalizeBpm(cue.bpm);
    }
    duration.textContent = formatDuration(cue.seconds);
    if (mobileDuration) {
      mobileDuration.textContent = formatDuration(cue.seconds);
    }
    item.dataset.id = cue.id;

    for (const select of tuningSelects) {
      const field = select.dataset.field;

      if (!TUNING_FIELDS.has(field)) {
        continue;
      }

      const tuningValue = normalizeTuning(field, cue[field]);

      select.value = tuningValue;
      syncTuningCell(select.closest(".tuning-cell"), field, tuningValue);
      syncCueMobileTuningChip(item, field, tuningValue);
    }

    for (const button of moveButtons) {
      const direction = button.dataset.direction;
      const isUp = direction === "up";
      button.disabled = isUp ? index === 0 : index === cues.length - 1;
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

function moveCue(id, offset) {
  const currentIndex = cues.findIndex((cue) => cue.id === id);

  if (currentIndex < 0) {
    return;
  }

  const nextIndex = currentIndex + offset;

  if (nextIndex < 0 || nextIndex >= cues.length) {
    return;
  }

  const nextCues = [...cues];
  const [movedCue] = nextCues.splice(currentIndex, 1);

  nextCues.splice(nextIndex, 0, movedCue);
  cues = nextCues;
  render();
}

function parseDurationInputs() {
  const minutesValue = durationMinutesInput.value.trim();
  const secondsValue = durationSecondsInput.value.trim();

  if (minutesValue === "" || secondsValue === "") {
    return null;
  }

  const minutes = Number(minutesValue);
  const seconds = Number(secondsValue);

  if (
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds >= 60
  ) {
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
    const mobileMenu = item?.querySelector(".cue-mobile-actions");
    const bpmListInput = item?.querySelector(".cue-mobile-bpm-input") || item?.querySelector(".bpm-list-input");

    if (mobileMenu && window.matchMedia("(max-width: 760px)").matches) {
      mobileMenu.setAttribute("open", "");
    }

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

function syncCueMobileTuningChip(item, field, value) {
  const chip = item.querySelector(`.cue-mobile-tuning-chip[data-field="${field}"]`);

  if (!chip) {
    return;
  }

  chip.dataset.tuning = normalizeTuning(field, value);
}

function syncCueBpmControls(item, value) {
  for (const input of item.querySelectorAll(".bpm-list-input")) {
    input.value = value;
  }
}

function syncCueTuningControls(item, field, value) {
  for (const select of item.querySelectorAll(`.tuning-select[data-field="${field}"]`)) {
    select.value = value;
  }

  for (const cell of item.querySelectorAll(`.tuning-cell[data-field="${field}"]`)) {
    syncTuningCell(cell, field, value);
  }

  syncCueMobileTuningChip(item, field, value);
}

function closeCueMobileMenu(item) {
  const menu = item.querySelector(".cue-mobile-actions[open]");

  if (menu) {
    menu.removeAttribute("open");
  }
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
  const isPersonalStorage = authSession.authenticated;

  saveButton.disabled = !canSaveToDatabase || saveInFlight || !dirty;
  clearAllButton.disabled = storageMode === STORAGE_MODE_LOADING || saveInFlight || cues.length === 0;
  saveStatus.classList.toggle("is-dirty", needsAttention);
  saveStatus.classList.toggle(
    "is-error",
    storageMode === STORAGE_MODE_LOCAL && Boolean(storageWarningMessage),
  );

  saveButton.textContent = isPersonalStorage ? "내 목록 저장하기" : "목록 저장하기";

  if (storageMode === STORAGE_MODE_LOADING) {
    saveStatus.textContent = "저장 상태와 DB 연결을 확인하는 중입니다.";
    return;
  }

  if (!databaseConfigured) {
    saveStatus.textContent = "DB 연결이 아직 설정되지 않았습니다.";
    return;
  }

  if (saveInFlight) {
    saveStatus.textContent = isPersonalStorage
      ? "현재 목록을 내 계정에 저장하는 중입니다."
      : "비밀번호를 확인한 뒤 현재 목록을 DB에 저장하는 중입니다.";
    return;
  }

  if (saved) {
    saveStatus.textContent = isPersonalStorage
      ? "현재 목록을 내 계정에 저장했습니다."
      : "현재 목록을 DB에 저장했습니다.";
    return;
  }

  if (storageMode === STORAGE_MODE_DATABASE) {
    if (databaseSeedRequired) {
      saveStatus.textContent = isPersonalStorage
        ? "내 저장 목록이 비어 있습니다. 저장 버튼을 누르면 현재 목록을 계정에 저장합니다."
        : "공용 저장 목록이 비어 있습니다. 저장 버튼을 누르면 현재 목록을 처음 저장합니다.";
      return;
    }

    if (dirty) {
      saveStatus.textContent = isPersonalStorage
        ? "저장되지 않은 변경사항이 있습니다. 저장 버튼을 누르면 내 계정에 반영됩니다."
        : "저장되지 않은 변경사항이 있습니다. 저장 버튼을 누르면 비밀번호 확인 후 반영됩니다.";
      return;
    }

    saveStatus.textContent = isPersonalStorage
      ? "현재 목록이 내 계정에 저장되어 있습니다."
      : "현재 공용 목록이 DB에 저장되어 있습니다.";
    return;
  }

  if (dirty) {
    saveStatus.textContent = "DB 연결에 문제가 있어 현재 작업은 이 브라우저에만 남습니다.";
    return;
  }

  saveStatus.textContent = storageWarningMessage || "DB 연결에 문제가 있어 브라우저 캐시만 사용 중입니다.";
}

function renderGoogleSignInButton() {
  const configured = authSession.databaseConfigured && authSession.googleLoginConfigured;
  const clientId = authSession.googleClientId;

  if (!googleSignInButton || !configured || authSession.authenticated || !clientId) {
    return;
  }

  if (!window.google?.accounts?.id) {
    if (googleButtonRenderRetry < 20) {
      googleButtonRenderRetry += 1;
      window.setTimeout(renderGoogleSignInButton, 250);
    }
    return;
  }

  if (googleButtonRenderedForClientId === clientId) {
    return;
  }

  googleSignInButton.replaceChildren();
  googleButtonRenderRetry = 0;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredentialResponse,
  });
  window.google.accounts.id.renderButton(googleSignInButton, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.min(360, googleSignInButton.clientWidth || 320),
  });
  googleButtonRenderedForClientId = clientId;
}

function updateAuthUi() {
  const googleConfigured = authSession.databaseConfigured && authSession.googleLoginConfigured;
  const emailConfigured = authSession.databaseConfigured && authSession.emailLoginConfigured;

  if (googleSignInButton) {
    googleSignInButton.hidden = authSession.authenticated || !googleConfigured;
  }
  if (emailAuthForm) {
    emailAuthForm.hidden = authSession.authenticated || !emailConfigured;
  }
  if (emailAuthInput) {
    emailAuthInput.disabled = emailAuthInFlight || authSession.authenticated || !emailConfigured;
  }
  if (emailAuthCodeInput) {
    emailAuthCodeInput.disabled = emailAuthInFlight || authSession.authenticated || !emailConfigured;
  }
  if (emailAuthCodeButton) {
    emailAuthCodeButton.disabled = emailAuthInFlight || authSession.authenticated || !emailConfigured;
  }
  if (emailAuthVerifyButton) {
    emailAuthVerifyButton.disabled = emailAuthInFlight || authSession.authenticated || !emailConfigured;
  }
  authAccount.hidden = !authSession.authenticated;
  logoutButton.disabled = authInFlight || emailAuthInFlight;

  if (authSession.authenticated) {
    const maskedEmail = maskEmail(authSession.email);

    authTitle.textContent = "로그인됨";
    authEmailLabel.textContent = maskedEmail;
    authStatus.textContent = authNotice || `${maskedEmail} 계정으로 개인 큐시트를 저장합니다.`;
    return;
  }

  authEmailLabel.textContent = "";
  authTitle.textContent = emailConfigured
    ? "이메일로 가입 / 로그인"
    : "Google 계정으로 가입 / 로그인";

  if (!authSession.databaseConfigured) {
    authStatus.textContent = authSession.message || "DB 연결이 아직 설정되지 않았습니다.";
    return;
  }

  if (!googleConfigured && !emailConfigured) {
    authStatus.textContent = "SMTP 또는 Google 로그인 환경변수 설정이 필요합니다.";
    return;
  }

  authStatus.textContent = authNotice || (emailConfigured
    ? "이메일 인증으로 가입하거나 로그인할 수 있습니다."
    : "Google 계정으로 가입하거나 로그인할 수 있습니다.");
  renderGoogleSignInButton();
}

function getDragAfterElement(container, pointerY) {
  const items = [...container.querySelectorAll(
    ".cue-item:not(.is-dragging):not(.is-touch-dragging)",
  )];
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

function setupCueInteractDrag() {
  if (cueInteractInitialized) {
    return;
  }

  if (typeof window.interact !== "function") {
    console.warn("Interact.js가 로드되지 않아 큐시트 드래그 정렬을 사용할 수 없습니다.");
    return;
  }

  cueInteractInitialized = true;

  window.interact(".drag-handle").draggable({
    autoScroll: true,
    listeners: {
      start: startCueInteractDrag,
      move: moveCueInteractDrag,
      end: finishCueInteractDrag,
    },
  });
}

function startCueInteractDrag(event) {
  const item = event.target.closest(".cue-item");

  if (!item || !cueList.contains(item) || cues.length < 2) {
    clearCueInteractDragState();
    return;
  }

  clearCueInteractDragState();

  const box = item.getBoundingClientRect();
  const pointer = getInteractPointer(event);
  const pointerX = Number.isFinite(pointer.x) ? pointer.x : box.left + (box.width / 2);
  const pointerY = Number.isFinite(pointer.y) ? pointer.y : box.top + (box.height / 2);
  const ghost = item.cloneNode(true);

  ghost.classList.add("cue-touch-drag-ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.querySelectorAll("[id]").forEach((element) => {
    element.removeAttribute("id");
  });
  ghost.style.left = `${box.left}px`;
  ghost.style.top = `${box.top}px`;
  ghost.style.width = `${box.width}px`;
  ghost.style.height = `${box.height}px`;

  const dragLayer = item.closest("dialog[open]") || document.body;

  dragLayer.appendChild(ghost);
  item.classList.add("is-touch-dragging");
  document.body.classList.add("has-cue-touch-drag");

  cueInteractDragState = {
    item,
    ghost,
    offsetX: pointerX - box.left,
    offsetY: pointerY - box.top,
    pointerX,
    pointerY,
    translateX: 0,
    translateY: 0,
  };
}

function moveCueInteractDrag(event) {
  const state = cueInteractDragState;

  if (!state?.item.isConnected) {
    clearCueInteractDragState();
    return;
  }

  const pointer = getInteractPointer(event);
  const fallbackDeltaX = Number.isFinite(pointer.x) ? pointer.x - state.pointerX : 0;
  const fallbackDeltaY = Number.isFinite(pointer.y) ? pointer.y - state.pointerY : 0;
  const deltaX = getInteractDelta(event, "x", fallbackDeltaX);
  const deltaY = getInteractDelta(event, "y", fallbackDeltaY);

  state.translateX += deltaX;
  state.translateY += deltaY;
  state.pointerX = Number.isFinite(pointer.x) ? pointer.x : state.pointerX + deltaX;
  state.pointerY = Number.isFinite(pointer.y) ? pointer.y : state.pointerY + deltaY;
  state.ghost.style.transform = `translate3d(${state.translateX}px, ${state.translateY}px, 0)`;

  const nextItem = getDragAfterElement(cueList, state.pointerY);

  if (!nextItem) {
    cueList.appendChild(state.item);
    return;
  }

  cueList.insertBefore(state.item, nextItem);
}

function finishCueInteractDrag() {
  if (cueInteractDragState) {
    syncCueOrderWithDom();
  }

  clearCueInteractDragState();
}

function clearCueInteractDragState() {
  if (!cueInteractDragState) {
    return;
  }

  cueInteractDragState.item?.classList.remove("is-touch-dragging");
  cueInteractDragState.ghost?.remove();
  document.body.classList.remove("has-cue-touch-drag");
  cueInteractDragState = null;
}

function getInteractPointer(event) {
  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  const interactionClient = event.interaction?.coords?.cur?.client;

  if (Number.isFinite(interactionClient?.x) && Number.isFinite(interactionClient?.y)) {
    return {
      x: interactionClient.x,
      y: interactionClient.y,
    };
  }

  if (Number.isFinite(event.client?.x) && Number.isFinite(event.client?.y)) {
    return {
      x: event.client.x,
      y: event.client.y,
    };
  }

  if (Number.isFinite(event.page?.x) && Number.isFinite(event.page?.y)) {
    return {
      x: event.page.x - window.scrollX,
      y: event.page.y - window.scrollY,
    };
  }

  if (!Number.isFinite(event.pageX) || !Number.isFinite(event.pageY)) {
    return {
      x: Number.NaN,
      y: Number.NaN,
    };
  }

  return {
    x: event.pageX - window.scrollX,
    y: event.pageY - window.scrollY,
  };
}

function getInteractDelta(event, axis, fallback) {
  const value = axis === "x" ? event.dx : event.dy;

  if (Number.isFinite(value)) {
    return value;
  }

  return Number.isFinite(fallback) ? fallback : 0;
}

function syncCueOrderWithDom() {
  const orderedIds = [...cueList.querySelectorAll(".cue-item")]
    .filter((item) => !item.classList.contains("cue-touch-drag-ghost"))
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

function setupTodoInteractDrag() {
  if (todoInteractInitialized) {
    return;
  }

  if (typeof window.interact !== "function") {
    console.warn("Interact.js가 로드되지 않아 할 일 드래그 정렬을 사용할 수 없습니다.");
    return;
  }

  todoInteractInitialized = true;

  window.interact(".todo-check-drag-handle").draggable({
    autoScroll: true,
    listeners: {
      start: startTodoInteractDrag,
      move: moveTodoInteractDrag,
      end: finishTodoInteractDrag,
    },
  });
}

function startTodoInteractDrag(event) {
  event.preventDefault?.();

  if (!requireTodoEditAccess()) {
    clearTodoInteractDragState();
    return;
  }

  const item = event.target.closest(".todo-check-row");
  const checkRows = todoEditor ? [...todoEditor.querySelectorAll(".todo-check-row")] : [];

  if (!item || !todoEditor?.contains(item) || checkRows.length < 2) {
    clearTodoInteractDragState();
    return;
  }

  clearTodoInteractDragState();
  saveTodoSelection();

  const box = item.getBoundingClientRect();
  const pointer = getInteractPointer(event);
  const pointerX = Number.isFinite(pointer.x) ? pointer.x : box.left + (box.width / 2);
  const pointerY = Number.isFinite(pointer.y) ? pointer.y : box.top + (box.height / 2);
  const ghost = item.cloneNode(true);

  ghost.classList.add("todo-touch-drag-ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.left = `${box.left}px`;
  ghost.style.top = `${box.top}px`;
  ghost.style.width = `${box.width}px`;
  ghost.style.height = `${box.height}px`;

  const dragLayer = item.closest("dialog[open]") || document.body;

  dragLayer.appendChild(ghost);
  item.classList.add("is-touch-dragging");
  document.body.classList.add("has-todo-touch-drag");

  todoInteractDragState = {
    item,
    ghost,
    container: item.parentElement || todoEditor,
    offsetX: pointerX - box.left,
    offsetY: pointerY - box.top,
    pointerX,
    pointerY,
    ghostLeft: box.left,
    ghostTop: box.top,
  };
}

function moveTodoInteractDrag(event) {
  event.preventDefault?.();

  const state = todoInteractDragState;

  if (!state?.item.isConnected) {
    clearTodoInteractDragState();
    return;
  }

  const pointer = getInteractPointer(event);
  const fallbackDeltaX = Number.isFinite(pointer.x) ? pointer.x - state.pointerX : 0;
  const fallbackDeltaY = Number.isFinite(pointer.y) ? pointer.y - state.pointerY : 0;
  const deltaX = getInteractDelta(event, "x", fallbackDeltaX);
  const deltaY = getInteractDelta(event, "y", fallbackDeltaY);

  if (Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
    state.pointerX = pointer.x;
    state.pointerY = pointer.y;
    state.ghostLeft = pointer.x - state.offsetX;
    state.ghostTop = pointer.y - state.offsetY;
  } else {
    state.pointerX += deltaX;
    state.pointerY += deltaY;
    state.ghostLeft += deltaX;
    state.ghostTop += deltaY;
  }

  state.ghost.style.left = `${state.ghostLeft}px`;
  state.ghost.style.top = `${state.ghostTop}px`;

  const container = state.container?.isConnected ? state.container : todoEditor;
  const nextItem = getTodoDragAfterElement(container, state.pointerY);

  if (!nextItem) {
    container.appendChild(state.item);
    return;
  }

  container.insertBefore(state.item, nextItem);
}

function finishTodoInteractDrag() {
  const shouldSave = Boolean(todoInteractDragState);

  clearTodoInteractDragState();

  if (shouldSave) {
    saveTodoDocument();
  }
}

function clearTodoInteractDragState() {
  if (!todoInteractDragState) {
    return;
  }

  todoInteractDragState.item?.classList.remove("is-touch-dragging");
  todoInteractDragState.ghost?.remove();
  document.body.classList.remove("has-todo-touch-drag");
  todoInteractDragState = null;
}

function getTodoDragAfterElement(container, pointerY) {
  const items = [...container.children]
    .filter((item) => item.matches?.(".todo-check-row:not(.is-touch-dragging)"));
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
