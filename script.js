const CUES_API_ENDPOINT = "/api/cues";
const AUDIENCE_CUES_ENDPOINT = "/api/audience-cues";
const PRACTICE_API_ENDPOINT = "/api/practice";
const AUTH_SESSION_ENDPOINT = "/api/auth/session";
const AUTH_GOOGLE_ENDPOINT = "/api/auth/google";
const AUTH_LOGIN_ENDPOINT = "/api/auth/login";
const AUTH_LOGOUT_ENDPOINT = "/api/auth/logout";
const MEMBER_API_ENDPOINT = "/api/member";
const GROUPS_API_ENDPOINT = "/api/groups";
const PERFORMANCES_API_ENDPOINT = "/api/performances";
const TODO_AUTH_ENDPOINT = "/api/todo-auth";
const TODOS_API_ENDPOINT = "/api/todos";
const ANONYMOUS_STORAGE_KEY = "cue-sheet-anonymous-draft-v2";
const LEGACY_ANONYMOUS_STORAGE_KEY = "cue-sheet-anonymous-draft";
const AUTH_CHANNEL_NAME = "cue-sheet-auth-session";
const AUTH_STORAGE_EVENT_KEY = "cue-sheet-auth-session-event";
const PRACTICE_LOG_STORAGE_KEY = "cue-sheet-practice-log";
const TODO_STORAGE_KEY = "cue-sheet-todo-document";
const PENDING_TAP_BPM_STORAGE_KEY = "cue-sheet-pending-tap-bpm";
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
const isCueWorkspacePage = document.body.classList.contains("cue-workspace-page");
const authTitle = document.querySelector("#authTitle");
const authStatus = document.querySelector("#authStatus");
const googleSignInButton = document.querySelector("#googleSignInButton");
const emailAuthForm = document.querySelector("#emailAuthForm");
const emailAuthInput = document.querySelector("#emailAuthInput");
const emailPasswordInput = document.querySelector("#emailPasswordInput");
const emailLoginButton = document.querySelector("#emailLoginButton");
const authAccount = document.querySelector("#authAccount");
const authEmailLabel = document.querySelector("#authEmailLabel");
const logoutButton = document.querySelector("#logoutButton");
const memberLoginLink = document.querySelector(".member-login-link");
const memberDirectoryList = document.querySelector("#memberDirectoryList");
const memberPanel = document.querySelector("#memberPanel");
const memberStatus = document.querySelector("#memberStatus");
const memberProfileModalStatus = document.querySelector("#memberProfileModalStatus");
const memberGroupModalStatus = document.querySelector("#memberGroupModalStatus");
const memberProfileForm = document.querySelector("#memberProfileForm");
const memberProfileImage = document.querySelector("#memberProfileImage");
const memberProfileInitial = document.querySelector("#memberProfileInitial");
const memberProfileNameInput = document.querySelector("#memberProfileNameInput");
const memberProfileEmailInput = document.querySelector("#memberProfileEmailInput");
const memberProfileRegionInput = document.querySelector("#memberProfileRegionInput");
const memberProfilePositionInput = document.querySelector("#memberProfilePositionInput");
const memberProfileGenreInput = document.querySelector("#memberProfileGenreInput");
const memberProfilePictureInput = document.querySelector("#memberProfilePictureInput");
const memberProfilePictureButton = document.querySelector("#memberProfilePictureButton");
const memberProfilePictureRemoveButton = document.querySelector("#memberProfilePictureRemoveButton");
const memberProfileMemoInput = document.querySelector("#memberProfileMemoInput");
const memberProfileSaveButton = document.querySelector("#memberProfileSaveButton");
const memberDashboardList = document.querySelector("#memberDashboardList");
const memberGroupForm = document.querySelector("#memberGroupForm");
const memberGroupNameInput = document.querySelector("#memberGroupNameInput");
const memberGroupList = document.querySelector("#memberGroupList");
const memberInviteForm = document.querySelector("#memberInviteForm");
const memberInviteGroupSelect = document.querySelector("#memberInviteGroupSelect");
const memberInviteEmailInput = document.querySelector("#memberInviteEmailInput");
const memberInviteButton = document.querySelector("#memberInviteButton");
const memberMessageList = document.querySelector("#memberMessageList");
const memberGroupDetail = document.querySelector("#memberGroupDetail");
const memberGroupDetailTitle = document.querySelector("#memberGroupDetailTitle");
const memberGroupDetailRole = document.querySelector("#memberGroupDetailRole");
const memberGroupDetailStatus = document.querySelector("#memberGroupDetailStatus");
const memberGroupMemberList = document.querySelector("#memberGroupMemberList");
const memberGroupCueForm = document.querySelector("#memberGroupCueForm");
const memberGroupCueTitleInput = document.querySelector("#memberGroupCueTitleInput");
const memberGroupCueList = document.querySelector("#memberGroupCueList");
const memberGroupNoticeForm = document.querySelector("#memberGroupNoticeForm");
const memberGroupNoticeTitleInput = document.querySelector("#memberGroupNoticeTitleInput");
const memberGroupNoticeBodyInput = document.querySelector("#memberGroupNoticeBodyInput");
const memberGroupNoticeList = document.querySelector("#memberGroupNoticeList");
const memberPerformanceForm = document.querySelector("#memberPerformanceForm");
const memberPerformanceTitleInput = document.querySelector("#memberPerformanceTitleInput");
const memberPerformanceDateInput = document.querySelector("#memberPerformanceDateInput");
const memberPerformanceLocationInput = document.querySelector("#memberPerformanceLocationInput");
const memberPerformanceMemoInput = document.querySelector("#memberPerformanceMemoInput");
const memberPerformanceCueForm = document.querySelector("#memberPerformanceCueForm");
const memberPerformanceSelect = document.querySelector("#memberPerformanceSelect");
const memberPerformanceCueSelect = document.querySelector("#memberPerformanceCueSelect");
const memberPerformanceList = document.querySelector("#memberPerformanceList");
const memberMemoForm = document.querySelector("#memberMemoForm");
const memberMemoInput = document.querySelector("#memberMemoInput");
const memberMemoSaveButton = document.querySelector("#memberMemoSaveButton");
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
const cueModalTotalDuration = document.querySelector("#cueModalTotalDuration");
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
const audienceModal = document.querySelector("#audienceModal");
const workspaceAudienceStatus = document.querySelector("#workspaceAudienceStatus");
const workspaceAudienceCount = document.querySelector("#workspaceAudienceCount");
const workspaceAudienceRefreshButton = document.querySelector("#workspaceAudienceRefreshButton");
const workspaceAudienceEmpty = document.querySelector("#workspaceAudienceEmpty");
const workspaceAudienceList = document.querySelector("#workspaceAudienceList");
const blockingModals = document.querySelectorAll("dialog.modal");
const modalTriggers = document.querySelectorAll("[data-modal-target]");
const memberModalTriggers = document.querySelectorAll("[data-member-modal-trigger]");
const modalCloseButtons = document.querySelectorAll("[data-modal-close]");
const todoEditor = document.querySelector("#todoEditor");
const todoStatus = document.querySelector("#todoStatus");
const todoLockForm = document.querySelector("#todoLockForm");
const todoPasswordInput = document.querySelector("#todoPasswordInput");
const todoUnlockButton = document.querySelector("#todoUnlockButton");
const todoToolbarButtons = document.querySelectorAll("[data-todo-command]");
const cueItemTemplate = document.querySelector("#cueItemTemplate");
const hasCueEditor = Boolean(cueModal && cueForm && cueList && cueItemTemplate);
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
  resolved: false,
  authenticated: false,
  userId: "",
  email: "",
  databaseConfigured: false,
  googleLoginConfigured: false,
  emailLoginConfigured: false,
  googleClientId: "",
};
let authInFlight = false;
let emailAuthInFlight = false;
let authRefreshInFlight = false;
let authGeneration = 0;
let authCoordinationReady = false;
let authChannel = null;
let lastAuthRefreshAt = 0;
let authRefreshPending = false;
let authRefreshTimer = null;
let authNotice = "";
let memberDirectory = [];
let memberProfile = null;
let memberDashboard = null;
let memberGroups = [];
let memberMessages = [];
let selectedMemberGroupId = "";
let memberGroupDetailData = null;
let memberGroupMembers = [];
let memberGroupCues = [];
let memberGroupMessages = [];
let memberGroupPerformances = [];
let memberPerformanceCueLinks = {};
let memberNotice = "";
let memberWorkspaceInFlight = false;
let memberActionInFlight = false;
let memberGroupDetailInFlight = false;
let memberGroupDetailLoadVersion = 0;
let pendingMemberGroupFocusId = "";
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
let cueStorageLoadVersion = 0;
let cueStorageDisplayLocked = false;
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
let todoUserScoped = false;
let workspaceAudienceLoadVersion = 0;

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

for (const modal of blockingModals) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });

  modal.addEventListener("close", () => {
    if (modal === cueModal) {
      closeCueEntryOverlay({ restoreFocus: false });
    }

    syncModalState();
  });
}

workspaceAudienceRefreshButton?.addEventListener("click", () => {
  loadWorkspaceAudiencePreview();
});

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
  loginWithEmailPassword();
});

memberGroupForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  createMemberGroup();
});

memberInviteForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMemberInvite();
});

memberMessageList?.addEventListener("click", (event) => {
  const acceptButton = event.target.closest("[data-member-invite-accept]");
  const rejectButton = event.target.closest("[data-member-invite-reject]");
  const readButton = event.target.closest("[data-member-message-read]");
  const groupLink = event.target.closest("[data-member-message-group]");

  if (acceptButton) {
    acceptMemberInvite(acceptButton.dataset.memberInviteAccept);
    return;
  }

  if (rejectButton) {
    rejectMemberInvite(rejectButton.dataset.memberInviteReject);
    return;
  }

  if (readButton) {
    markMemberMessageRead(readButton.dataset.memberMessageRead, readButton.dataset.memberMessageType);
    return;
  }

  if (groupLink) {
    loadMemberGroupDetail(groupLink.dataset.memberMessageGroup);
  }
});

memberMemoForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveMemberMemo();
});

memberProfileForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveMemberProfile();
});

memberProfilePictureButton?.addEventListener("click", () => {
  window.ProfileImageEditor?.open({ onSave: uploadMemberProfileImage });
});

memberProfilePictureRemoveButton?.addEventListener("click", removeMemberProfileImage);

memberProfileNameInput?.addEventListener("input", () => {
  if (!memberProfilePictureInput?.value.trim()) {
    renderMemberProfilePreview({
      name: memberProfileNameInput.value,
      pictureUrl: "",
    });
  }
});

memberGroupList?.addEventListener("click", (event) => {
  const groupOption = event.target.closest("[data-member-group-detail]");

  if (!groupOption) {
    return;
  }

  pendingMemberGroupFocusId = groupOption.dataset.memberGroupDetail;
  groupOption.focus();
  loadMemberGroupDetail(groupOption.dataset.memberGroupDetail);
});

memberGroupList?.addEventListener("keydown", (event) => {
  const groupOption = event.target.closest("[data-member-group-detail]");
  if (!groupOption) return;

  const options = [...memberGroupList.querySelectorAll("[data-member-group-detail]")];
  const currentIndex = options.indexOf(groupOption);
  let nextOption = null;
  let shouldSelect = false;

  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    nextOption = options[(currentIndex + 1) % options.length];
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    nextOption = options[(currentIndex - 1 + options.length) % options.length];
  } else if (event.key === "Home") {
    nextOption = options[0];
  } else if (event.key === "End") {
    nextOption = options[options.length - 1];
  } else if (event.key === "Enter" || event.key === " ") {
    nextOption = groupOption;
    shouldSelect = true;
  }

  if (!nextOption) return;

  event.preventDefault();
  nextOption.focus();
  if (shouldSelect) {
    pendingMemberGroupFocusId = nextOption.dataset.memberGroupDetail;
    loadMemberGroupDetail(nextOption.dataset.memberGroupDetail);
  }
});

memberGroupCueForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentCuesToMemberGroup();
});

memberGroupCueList?.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-member-group-cue-load]");
  const deleteButton = event.target.closest("[data-member-group-cue-delete]");

  if (loadButton) {
    loadMemberGroupCue(loadButton.dataset.memberGroupCueLoad);
    return;
  }

  if (deleteButton) {
    deleteMemberGroupCue(deleteButton.dataset.memberGroupCueDelete);
  }
});

memberGroupNoticeForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMemberGroupNotice();
});

memberPerformanceForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  createMemberPerformance();
});

memberPerformanceCueForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  attachMemberPerformanceCue();
});

cueForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const completedEntryMode = cueEntryMode;

  if (!appendCueFromForm()) {
    return;
  }

  closeCueEntryOverlay({ restoreFocus: false, resetForm: false });
  cueForm.reset();
  (completedEntryMode === CUE_TYPE_INTERMISSION ? addIntermissionButton : openCueEntryButton)?.focus();
});

saveButton?.addEventListener("click", async () => {
  if (saveInFlight || storageMode !== STORAGE_MODE_DATABASE || !hasPendingChanges()) {
    return;
  }

  const saveIdentity = getCueStorageIdentity();

  if (!saveIdentity) {
    window.alert("로그인 상태를 확인한 뒤 다시 저장해 주세요.");
    return;
  }

  let password = "";

  if (saveIdentity === "anonymous") {
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

  if (saveIdentity !== "anonymous") {
    const sessionCheck = await verifyCueSaveSession(saveIdentity);

    if (!sessionCheck.ok) {
      saveInFlight = false;
      updateActionState();
      window.alert(sessionCheck.message);
      return;
    }
  }

  const saveItems = cloneCues(cues);
  const saveResult = await persistCurrentCues(saveItems, password, saveIdentity);

  saveInFlight = false;

  if (!saveResult.ok) {
    updateActionState();
    window.alert(saveResult.message || "저장에 실패했습니다.");

    if (saveResult.code === "session_changed") {
      await refreshWorkspaceAfterCueSessionChange();
    }
    return;
  }

  if (saveIdentity !== getCueStorageIdentity()) {
    updateActionState();
    window.alert("저장 중 로그인 계정이 변경되어 목록을 다시 불러옵니다.");
    await refreshWorkspaceAfterCueSessionChange();
    return;
  }

  savedCues = cloneCues(saveItems);
  databaseSeedRequired = false;
  updateActionState(!hasPendingChanges());
});

clearAllButton?.addEventListener("click", () => {
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

bpmInput?.addEventListener("input", () => {
  bpmInput.value = normalizeBpm(bpmInput.value);
});

tapTempoButton?.addEventListener("click", () => {
  registerTapTempoClick();
});

tapTempoApplyButton?.addEventListener("click", () => {
  if (!measuredTapBpm) {
    return;
  }

  if (!hasCueEditor) {
    try {
      window.sessionStorage.setItem(PENDING_TAP_BPM_STORAGE_KEY, measuredTapBpm);
    } catch {
      // Ignore session storage failures and still move to the editor.
    }

    window.location.href = "./cues.html#cue-editor";
    return;
  }

  openCueEntryOverlay({
    resetForm: false,
    type: CUE_TYPE_SONG,
    restoreTarget: openCueEntryButton,
  });

  if (bpmInput) {
    bpmInput.value = measuredTapBpm;
    bpmInput.focus();
    bpmInput.select();
  }
});

tapTempoResetButton?.addEventListener("click", () => {
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

cueList?.addEventListener("input", (event) => {
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

cueList?.addEventListener("click", (event) => {
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

cueList?.addEventListener("change", (event) => {
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

cueList?.addEventListener("contextmenu", (event) => {
  if (cueInteractDragState) {
    event.preventDefault();
  }
});

setupCueInteractDrag();
setupTodoInteractDrag();

window.addEventListener("beforeunload", (event) => {
  if (!hasCueEditor || !hasPendingChanges()) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("pagehide", () => {
  stopMetronome();
});

setupAuthCoordination();
bootstrap();

async function bootstrap() {
  await loadTodoDocument();
  render();
  updateTapTempoState();
  updateAuthUi();
  await loadMemberDirectory();
  updateMemberUi();
  await initializeAuth();
  await Promise.all([
    initializePracticeTracker(),
    initializeStorage(),
  ]);
  restorePendingTapBpm();
  authCoordinationReady = true;

  if (authRefreshPending) {
    scheduleAuthSessionRefresh();
  }
}

async function initializeAuth() {
  const initializationGeneration = authGeneration;
  const initialSession = await loadAuthSession();

  if (initializationGeneration === authGeneration) {
    setAuthSession(initialSession);
    authNotice = "";
  } else {
    authRefreshPending = true;
  }
  updateAuthUi();

  if (authSession.authenticated) {
    await loadMemberWorkspace();
    return;
  }

  resetMemberWorkspace();
}

async function initializeStorage() {
  if (!cueList && !totalDuration && !cueForm && !saveButton) {
    return;
  }

  const loadVersion = ++cueStorageLoadVersion;
  const storageIdentity = getCueStorageIdentity();

  storageMode = STORAGE_MODE_LOADING;
  updateAuthUi();
  updateActionState();

  databaseSeedRequired = false;
  storageWarningMessage = "";

  if (!storageIdentity) {
    setCueStorageDisplayLocked(true);
    savedCues = [];
    cues = [];
    databaseConfigured = authSession.databaseConfigured;
    storageMode = STORAGE_MODE_LOCAL;
    storageWarningMessage = "로그인 상태를 확인하지 못해 개인 큐시트를 불러오지 않았습니다.";
    render();
    updateActionState();
    return;
  }

  setCueStorageDisplayLocked(false);

  const isPersonalStorage = storageIdentity !== "anonymous";
  const localCues = isPersonalStorage ? [] : loadLocalCues();

  savedCues = cloneCues(localCues);
  cues = cloneCues(localCues);
  render();

  const remoteResult = await loadRemoteCues();

  if (
    loadVersion !== cueStorageLoadVersion
    || storageIdentity !== getCueStorageIdentity()
  ) {
    return;
  }

  databaseConfigured = remoteResult.databaseConfigured;

  if (!remoteResult.ok) {
    storageMode = STORAGE_MODE_LOCAL;
    storageWarningMessage = remoteResult.message;
    render();
    updateActionState();
    return;
  }

  if (!remoteCueScopeMatches(remoteResult, storageIdentity)) {
    storageMode = STORAGE_MODE_LOCAL;
    storageWarningMessage = "로그인 계정과 저장 데이터 범위가 일치하지 않아 목록을 표시하지 않았습니다.";
    savedCues = cloneCues(localCues);
    cues = cloneCues(localCues);
    render();
    updateActionState();
    return;
  }

  storageMode = STORAGE_MODE_DATABASE;
  storageWarningMessage = "";

  if (storageIdentity === "anonymous" && !remoteResult.items.length && localCues.length) {
    cues = cloneCues(localCues);
    savedCues = [];
    databaseSeedRequired = true;
    render();
    return;
  }

  const remoteCues = cloneCues(remoteResult.items);

  savedCues = remoteCues;
  cues = cloneCues(remoteCues);
  if (storageIdentity === "anonymous") {
    persistLocalCues(remoteCues);
  }
  render();
  updateActionState();
}

async function initializePracticeTracker() {
  if (!practiceCalendar && !practiceForm) {
    return;
  }

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

  if (!authSession.authenticated) {
    persistPracticeLogs();
  }
  renderPracticeCalendar();
}

function openModalById(modalId, section = "") {
  const modal = document.querySelector(`#${modalId}`);

  if (!modal) {
    return;
  }

  if (isCueWorkspacePage && modal === cueModal) {
    focusCueModalSection(section);
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

  if (modal.id === "profileModal" && memberProfileModalStatus) {
    memberProfileModalStatus.textContent = "프로필 정보를 확인하고 수정할 수 있습니다.";
  }

  if (modal.id === "groupModal" && memberGroupModalStatus) {
    memberGroupModalStatus.textContent = memberGroupDetailInFlight
      ? "그룹 상세를 불러오는 중입니다."
      : "그룹을 선택하면 오른쪽에 상세 정보가 표시됩니다.";
  }

  if (modal === audienceModal) {
    loadWorkspaceAudiencePreview();
  }

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
      return;
    }

    if (modal === audienceModal) {
      workspaceAudienceRefreshButton?.focus();
      return;
    }

    if (modal.id === "profileModal") {
      memberProfileNameInput?.focus();
      return;
    }

    if (modal.id === "groupModal") {
      const selectedGroup = memberGroupList?.querySelector('[aria-selected="true"]');

      (selectedGroup || memberGroupNameInput)?.focus();
    }
  });
}

function closeModal(modal) {
  if (!modal?.open) {
    return;
  }

  if (isCueWorkspacePage && modal === cueModal) {
    closeCueEntryOverlay({ restoreFocus: false });
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
  const hasOpenBlockingDialog = [...document.querySelectorAll("dialog[open]")]
    .some((dialog) => !(isCueWorkspacePage && dialog === cueModal));

  document.body.classList.toggle("has-modal-open", hasOpenBlockingDialog);
}

function focusCueModalSection(section) {
  if (section === "list") {
    cueListPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  cueEditorPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  openCueEntryButton?.focus();
}

async function loadWorkspaceAudiencePreview() {
  if (!workspaceAudienceList || !workspaceAudienceStatus || !workspaceAudienceEmpty) {
    return;
  }

  const loadVersion = ++workspaceAudienceLoadVersion;

  workspaceAudienceStatus.classList.remove("is-error");
  workspaceAudienceStatus.textContent = "공개된 최신 큐시트를 불러오는 중입니다.";
  workspaceAudienceList.replaceChildren();
  workspaceAudienceEmpty.hidden = false;
  workspaceAudienceEmpty.textContent = "공개된 큐시트를 확인하는 중입니다.";
  if (workspaceAudienceCount) {
    workspaceAudienceCount.textContent = "--";
  }
  workspaceAudienceRefreshButton?.setAttribute("aria-busy", "true");
  if (workspaceAudienceRefreshButton) {
    workspaceAudienceRefreshButton.disabled = true;
  }

  try {
    const response = await fetch(AUDIENCE_CUES_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      throw new Error(payload.message || "관객용 목록을 불러오지 못했습니다.");
    }

    if (loadVersion !== workspaceAudienceLoadVersion) {
      return;
    }

    renderWorkspaceAudiencePreview(normalizeCueCollection(payload.items));
  } catch (error) {
    if (loadVersion !== workspaceAudienceLoadVersion) {
      return;
    }

    workspaceAudienceList.replaceChildren();
    workspaceAudienceEmpty.hidden = false;
    workspaceAudienceEmpty.textContent = "목록을 불러오지 못했습니다.";
    workspaceAudienceStatus.classList.add("is-error");
    workspaceAudienceStatus.textContent = error.message || "관객용 목록을 불러오지 못했습니다.";
    if (workspaceAudienceCount) {
      workspaceAudienceCount.textContent = "--";
    }
  } finally {
    if (loadVersion === workspaceAudienceLoadVersion) {
      workspaceAudienceRefreshButton?.removeAttribute("aria-busy");
      if (workspaceAudienceRefreshButton) {
        workspaceAudienceRefreshButton.disabled = false;
      }
    }
  }
}

function renderWorkspaceAudiencePreview(items) {
  if (!workspaceAudienceList || !workspaceAudienceStatus || !workspaceAudienceEmpty) {
    return;
  }

  const songs = items.filter((item) => item.type !== CUE_TYPE_INTERMISSION);

  workspaceAudienceList.replaceChildren();
  workspaceAudienceEmpty.hidden = items.length > 0;
  workspaceAudienceEmpty.textContent = "아직 공개된 큐시트가 없습니다.";
  workspaceAudienceStatus.classList.remove("is-error");
  workspaceAudienceStatus.textContent = songs.length
    ? "공개된 최신 공연 순서입니다."
    : "공개된 큐시트가 없습니다.";

  if (workspaceAudienceCount) {
    workspaceAudienceCount.textContent = `${songs.length}곡`;
  }

  let partNumber = 1;
  let songNumber = 0;
  let shouldRenderPartHeading = true;

  for (const item of items) {
    if (item.type === CUE_TYPE_INTERMISSION) {
      const intermission = document.createElement("li");
      const title = document.createElement("strong");
      const duration = document.createElement("span");

      intermission.className = "workspace-audience-intermission";
      title.textContent = item.title || "인터미션";
      duration.textContent = formatDuration(item.seconds);
      intermission.append(title, duration);
      workspaceAudienceList.appendChild(intermission);
      partNumber += 1;
      shouldRenderPartHeading = true;
      continue;
    }

    if (shouldRenderPartHeading) {
      const heading = document.createElement("li");

      heading.className = "workspace-audience-part-heading";
      heading.textContent = `${partNumber}부`;
      workspaceAudienceList.appendChild(heading);
      shouldRenderPartHeading = false;
    }

    songNumber += 1;
    const cue = document.createElement("li");
    const number = document.createElement("span");
    const title = document.createElement("strong");

    cue.className = "workspace-audience-cue";
    number.textContent = String(songNumber).padStart(2, "0");
    title.textContent = item.title;
    cue.append(number, title);
    workspaceAudienceList.appendChild(cue);
  }
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
    todoUserScoped = Boolean(payload.userScoped || payload.authenticated);

    todoEditor.innerHTML = nextHtml;
    todoLastSavedHtml = remoteHtml;
    todoNeedsInitialDbSave = !todoUserScoped && !remoteHtml && Boolean(localHtml);
    todoEditUnlocked = todoUserScoped;
    todoEditPassword = todoUserScoped ? "" : todoEditPassword;
    normalizeTodoCheckboxes();
    syncTodoEditAccess({ updateStatus: false });
    updateTodoStatus(todoUserScoped
      ? "로그인 계정 기준으로 자동 저장됩니다."
      : todoNeedsInitialDbSave
        ? "기존 로컬 할 일을 불러왔습니다. 비밀번호 입력 후 DB에 저장됩니다."
        : "비밀번호 입력 후 편집할 수 있습니다.");
  } catch {
    todoUserScoped = false;
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
  if (todoEditUnlocked || todoUserScoped || authSession.authenticated) {
    todoEditUnlocked = true;
    syncTodoEditAccess({ updateStatus: false });
    return true;
  }

  updateTodoStatus("비밀번호 입력 후 편집할 수 있습니다.");
  todoPasswordInput?.focus();
  return false;
}

function syncTodoEditAccess({ updateStatus = true } = {}) {
  const locked = !(todoEditUnlocked || todoUserScoped || authSession.authenticated);

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

  if (!todoEditUnlocked && !todoUserScoped && !authSession.authenticated) {
    return;
  }

  normalizeTodoCheckboxes();
  syncTodoEditAccess({ updateStatus: false });
  const html = todoEditor.innerHTML;

  if (html === todoLastSavedHtml && !todoNeedsInitialDbSave) {
    updateTodoStatus("DB 저장됨");
    return;
  }

  if (!todoUserScoped && !authSession.authenticated && !todoEditPassword) {
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
        password: todoUserScoped || authSession.authenticated ? "" : todoEditPassword,
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
    todoUserScoped = Boolean(payload.userScoped || payload.authenticated || todoUserScoped);
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

  if (!cueEntryOverlay || !cueForm) {
    return;
  }

  if (!isCueWorkspacePage && !cueModal?.open) {
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
      durationMinutesInput?.focus();
      return;
    }

    titleInput?.focus();
  });
}

function closeCueEntryOverlay(options = {}) {
  const { restoreFocus = true, resetForm = true } = options;

  if (!cueEntryOverlay || cueEntryOverlay.hidden) {
    return;
  }

  cueEntryOverlay.hidden = true;

  if (resetForm) {
    cueForm?.reset();
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

  if (titleInput) {
    titleInput.placeholder = isIntermission ? "예: 인터미션" : "예: 오프닝 멘트";
  }
  if (bpmField) {
    bpmField.hidden = isIntermission;
  }
  if (bpmInput) {
    bpmInput.disabled = isIntermission;
  }

  if (cueEntrySubmitButton) {
    cueEntrySubmitButton.textContent = isIntermission ? "구분선 추가" : "추가";
  }

  if (isIntermission) {
    if (bpmInput) {
      bpmInput.value = "";
    }

    if (resetForm) {
      if (titleInput) {
        titleInput.value = "인터미션";
      }
      if (durationSecondsInput) {
        durationSecondsInput.value = "0";
      }
    }
  }
}

function appendCueFromForm() {
  if (!titleInput || !durationMinutesInput || !durationSecondsInput) {
    return false;
  }

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
    bpm: isIntermission ? "" : normalizeBpm(bpmInput?.value || ""),
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

  let password = "";

  if (!authSession.authenticated) {
    password = window.prompt("연습 캘린더 저장 비밀번호를 입력하세요.");

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

  if (!authSession.authenticated) {
    persistPracticeLogs();
  }

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

    if (!response.ok) {
      return createUnknownAuthSession(
        payload.message || "로그인 상태를 확인하지 못했습니다.",
        payload,
      );
    }

    return normalizeAuthSession({ ...payload, resolved: true });
  } catch {
    return createUnknownAuthSession("로그인 상태를 확인하지 못했습니다.");
  }
}

async function reloadAuthenticatedWorkspace() {
  await Promise.all([
    initializeStorage(),
    initializePracticeTracker(),
    loadTodoDocument(),
    loadMemberWorkspace(),
    loadMemberDirectory(),
  ]);
}

async function loadMemberDirectory() {
  if (!memberDirectoryList) {
    return;
  }

  try {
    const result = await fetchMemberJson("directory");

    if (!result.ok) {
      throw new Error(result.payload.message || "회원 목록을 불러오지 못했습니다.");
    }

    memberDirectory = normalizeMemberDirectory(result.payload.members);
  } catch {
    memberDirectory = [];
  }

  renderMemberDirectory();
}

async function loadMemberWorkspace() {
  if (!authSession.authenticated) {
    resetMemberWorkspace();
    return;
  }

  memberWorkspaceInFlight = true;
  memberNotice = "회원 정보를 불러오는 중입니다.";
  updateMemberUi();

  try {
    const [profileResult, dashboardResult, groupsResult, messagesResult, memoResult] = await Promise.all([
      fetchMemberJson("profile"),
      fetchMemberJson("dashboard"),
      fetchMemberJson("groups"),
      fetchMemberJson("messages"),
      fetchMemberJson("memo"),
    ]);

    for (const result of [profileResult, dashboardResult, groupsResult, messagesResult, memoResult]) {
      if (!result.ok) {
        throw new Error(result.payload.message || "회원 정보를 불러오지 못했습니다.");
      }
    }

    memberProfile = normalizeMemberProfile(profileResult.payload.profile);
    memberDashboard = normalizeMemberDashboard(dashboardResult.payload.dashboard);
    syncMemberProfileForm();
    memberGroups = normalizeMemberGroups(groupsResult.payload.groups);
    memberMessages = normalizeMemberMessages(messagesResult.payload.messages);
    syncSelectedMemberGroup();

    if (memberMemoInput) {
      memberMemoInput.value = String(memoResult.payload.content || "");
    }

    memberNotice = "";
    if (selectedMemberGroupId) {
      await loadMemberGroupDetail(selectedMemberGroupId, { silent: true });
    } else {
      resetMemberGroupDetail();
    }
  } catch (error) {
    memberNotice = error.message || "회원 정보를 불러오지 못했습니다.";
  } finally {
    memberWorkspaceInFlight = false;
    updateMemberUi();
  }
}

function resetMemberWorkspace() {
  memberProfile = null;
  memberDashboard = null;
  memberGroups = [];
  memberMessages = [];
  selectedMemberGroupId = "";
  resetMemberGroupDetail();
  memberNotice = "";
  memberWorkspaceInFlight = false;
  memberActionInFlight = false;
  memberGroupDetailInFlight = false;
  memberGroupDetailLoadVersion += 1;
  pendingMemberGroupFocusId = "";

  if (memberMemoInput) {
    memberMemoInput.value = "";
  }

  syncMemberProfileForm();

  updateMemberUi();
}

function syncSelectedMemberGroup() {
  if (!memberGroups.length) {
    selectedMemberGroupId = "";
    return;
  }

  if (memberGroups.some((group) => group.id === selectedMemberGroupId)) {
    return;
  }

  selectedMemberGroupId = memberGroups[0].id;
}

function resetMemberGroupDetail(options = {}) {
  if (!options.keepSelection) {
    selectedMemberGroupId = "";
  }

  memberGroupDetailData = null;
  memberGroupMembers = [];
  memberGroupCues = [];
  memberGroupMessages = [];
  memberGroupPerformances = [];
  memberPerformanceCueLinks = {};
}

async function saveMemberProfile() {
  if (!authSession.authenticated || memberActionInFlight) {
    return;
  }

  const name = String(memberProfileNameInput?.value || "").trim();
  const pictureUrl = String(memberProfilePictureInput?.value || "").trim();

  if (!name) {
    memberNotice = "이름을 입력해 주세요.";
    updateMemberUi();
    memberProfileNameInput?.focus();
    return;
  }

  if (pictureUrl && !isValidProfileUrl(pictureUrl)) {
    memberNotice = "프로필사진 URL은 http 또는 https 주소로 입력해 주세요.";
    updateMemberUi();
    memberProfilePictureInput?.focus();
    return;
  }

  memberActionInFlight = true;
  memberNotice = "프로필을 저장하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchMemberJson("profile", {
      method: "PUT",
      body: {
        name,
        region: memberProfileRegionInput?.value || "",
        position: memberProfilePositionInput?.value || "",
        genre: memberProfileGenreInput?.value || "",
        pictureUrl,
        memo: memberProfileMemoInput?.value || "",
      },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "프로필을 저장하지 못했습니다.";
      return;
    }

    memberProfile = normalizeMemberProfile(result.payload.profile);
    syncMemberProfileForm();
    await loadMemberDirectory();
    memberNotice = "프로필을 저장했습니다.";
  } catch {
    memberNotice = "프로필을 저장하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function uploadMemberProfileImage(dataUrl) {
  const result = await fetchMemberJson("profile-image", {
    method: "POST",
    body: { dataUrl },
  });

  if (!result.ok) {
    throw new Error(result.payload.message || "프로필 사진을 업로드하지 못했습니다.");
  }

  memberProfile = normalizeMemberProfile(result.payload.profile);
  syncMemberProfileForm();
  await loadMemberDirectory();
  memberNotice = "프로필 사진을 저장했습니다.";
  updateMemberUi();
}

async function removeMemberProfileImage() {
  if (!authSession.authenticated || memberActionInFlight || !memberProfile?.pictureUrl) return;
  memberActionInFlight = true;
  memberNotice = "프로필 사진을 삭제하는 중입니다.";
  updateMemberUi();
  try {
    const result = await fetchMemberJson("profile-image", { method: "DELETE" });
    if (!result.ok) throw new Error(result.payload.message);
    memberProfile = normalizeMemberProfile(result.payload.profile);
    syncMemberProfileForm();
    await loadMemberDirectory();
    memberNotice = "프로필 사진을 삭제했습니다.";
  } catch (error) {
    memberNotice = error.message || "프로필 사진을 삭제하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function createMemberGroup() {
  if (!authSession.authenticated || memberActionInFlight) {
    return;
  }

  const name = String(memberGroupNameInput?.value || "").trim();

  if (!name) {
    memberNotice = "그룹 이름을 입력해 주세요.";
    updateMemberUi();
    memberGroupNameInput?.focus();
    return;
  }

  memberActionInFlight = true;
  memberNotice = "그룹을 만드는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchMemberJson("groups", {
      method: "POST",
      body: { name },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "그룹을 만들지 못했습니다.";
      return;
    }

    if (memberGroupNameInput) {
      memberGroupNameInput.value = "";
    }

    await loadMemberWorkspace();
    memberNotice = "그룹을 만들었습니다.";
  } catch {
    memberNotice = "그룹을 만들지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function sendMemberInvite() {
  if (!authSession.authenticated || memberActionInFlight) {
    return;
  }

  const groupId = String(memberInviteGroupSelect?.value || "").trim();
  const email = normalizeEmail(memberInviteEmailInput?.value || "");

  if (!groupId) {
    memberNotice = "초대할 그룹을 선택해 주세요.";
    updateMemberUi();
    return;
  }

  if (!isValidEmail(email)) {
    memberNotice = "초대할 이메일 주소를 확인해 주세요.";
    updateMemberUi();
    memberInviteEmailInput?.focus();
    return;
  }

  memberActionInFlight = true;
  memberNotice = "초대를 보내는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchMemberJson("invites", {
      method: "POST",
      body: { groupId, email },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "초대를 보내지 못했습니다.";
      return;
    }

    if (memberInviteEmailInput) {
      memberInviteEmailInput.value = "";
    }

    memberNotice = "초대를 보냈습니다.";
  } catch {
    memberNotice = "초대를 보내지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function acceptMemberInvite(inviteId) {
  if (!authSession.authenticated || memberActionInFlight || !inviteId) {
    return;
  }

  memberActionInFlight = true;
  memberNotice = "초대를 수락하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchMemberJson("messages/accept", {
      method: "POST",
      body: { inviteId },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "초대를 수락하지 못했습니다.";
      return;
    }

    await loadMemberWorkspace();
    memberNotice = "초대를 수락했습니다.";
  } catch {
    memberNotice = "초대를 수락하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function rejectMemberInvite(inviteId) {
  if (!authSession.authenticated || memberActionInFlight || !inviteId) {
    return;
  }

  memberActionInFlight = true;
  memberNotice = "초대를 거절하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchMemberJson("invites/reject", {
      method: "POST",
      body: { inviteId },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "초대를 거절하지 못했습니다.";
      return;
    }

    await loadMemberWorkspace();
    memberNotice = "초대를 거절했습니다.";
  } catch {
    memberNotice = "초대를 거절하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function markMemberMessageRead(messageId, type = "invite") {
  if (!authSession.authenticated || memberActionInFlight || !messageId) {
    return;
  }

  memberActionInFlight = true;
  memberNotice = "메시지를 읽음 처리하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchMemberJson("messages/read", {
      method: "POST",
      body: {
        messageId,
        type,
      },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "읽음 처리하지 못했습니다.";
      return;
    }

    await loadMemberWorkspace();
    memberNotice = "메시지를 읽음 처리했습니다.";
  } catch {
    memberNotice = "읽음 처리하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function loadMemberGroupDetail(groupId, options = {}) {
  if (!authSession.authenticated || !groupId) {
    memberGroupDetailLoadVersion += 1;
    resetMemberGroupDetail();
    updateMemberUi();
    return;
  }

  const requestedGroupId = String(groupId);
  const loadVersion = ++memberGroupDetailLoadVersion;

  selectedMemberGroupId = requestedGroupId;
  if (memberGroupDetailData?.id && String(memberGroupDetailData.id) !== requestedGroupId) {
    resetMemberGroupDetail({ keepSelection: true });
  }
  memberGroupDetailInFlight = true;
  if (!options.silent) {
    memberNotice = "그룹 상세를 불러오는 중입니다.";
  }
  updateMemberUi();

  try {
    const [groupResult, membersResult, cuesResult, messagesResult, performancesResult] = await Promise.all([
      fetchGroupJson(requestedGroupId),
      fetchGroupJson(`${requestedGroupId}/members`),
      fetchGroupJson(`${requestedGroupId}/cues`),
      fetchGroupJson(`${requestedGroupId}/messages`),
      fetchPerformanceJson(`group/${requestedGroupId}`),
    ]);

    for (const result of [groupResult, membersResult, cuesResult, messagesResult, performancesResult]) {
      if (!result.ok) {
        throw new Error(result.payload.message || "그룹 상세를 불러오지 못했습니다.");
      }
    }

    const groupDetail = normalizeMemberGroupDetail(groupResult.payload.group);
    const groupMembers = normalizeMemberGroupMembers(membersResult.payload.members);
    const groupCues = normalizeMemberGroupCues(cuesResult.payload.cues);
    const groupMessages = normalizeMemberGroupMessages(messagesResult.payload.messages);
    const groupPerformances = normalizeMemberPerformances(performancesResult.payload.performances);
    const performanceCueLinks = await loadMemberPerformanceCueLinks(groupPerformances);

    if (loadVersion !== memberGroupDetailLoadVersion || selectedMemberGroupId !== requestedGroupId) {
      return;
    }

    memberGroupDetailData = groupDetail;
    memberGroupMembers = groupMembers;
    memberGroupCues = groupCues;
    memberGroupMessages = groupMessages;
    memberGroupPerformances = groupPerformances;
    memberPerformanceCueLinks = performanceCueLinks;

    if (!options.silent) {
      memberNotice = "그룹 상세를 불러왔습니다.";
    }
  } catch (error) {
    if (loadVersion !== memberGroupDetailLoadVersion || selectedMemberGroupId !== requestedGroupId) {
      return;
    }

    resetMemberGroupDetail({ keepSelection: true });
    memberNotice = error.message || "그룹 상세를 불러오지 못했습니다.";
  } finally {
    if (loadVersion === memberGroupDetailLoadVersion) {
      memberGroupDetailInFlight = false;
      updateMemberUi();
    }
  }
}

async function saveCurrentCuesToMemberGroup() {
  if (!authSession.authenticated || memberActionInFlight || !selectedMemberGroupId) {
    return;
  }

  const title = String(memberGroupCueTitleInput?.value || "").trim();

  if (!title) {
    memberNotice = "그룹 큐시트 제목을 입력해 주세요.";
    updateMemberUi();
    memberGroupCueTitleInput?.focus();
    return;
  }

  memberActionInFlight = true;
  memberNotice = "현재 목록을 그룹 큐시트로 저장하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchGroupJson(`${selectedMemberGroupId}/cues`, {
      method: "POST",
      body: {
        title,
        items: cues,
      },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "그룹 큐시트로 저장하지 못했습니다.";
      return;
    }

    if (memberGroupCueTitleInput) {
      memberGroupCueTitleInput.value = "";
    }

    await loadMemberGroupDetail(selectedMemberGroupId, { silent: true });
    memberNotice = "그룹 큐시트로 저장했습니다.";
  } catch {
    memberNotice = "그룹 큐시트로 저장하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function loadMemberGroupCue(cueId) {
  if (!authSession.authenticated || memberActionInFlight || !selectedMemberGroupId || !cueId) {
    return;
  }

  if (hasCueEditor && hasPendingChanges()) {
    const confirmed = window.confirm("현재 편집 중인 변경사항이 있습니다. 그룹 큐시트를 불러올까요?");

    if (!confirmed) {
      return;
    }
  }

  const requestGeneration = authGeneration;
  const requestIdentity = getCueStorageIdentity();

  memberActionInFlight = true;
  memberNotice = "그룹 큐시트를 불러오는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchGroupJson(`${selectedMemberGroupId}/cues/${cueId}`);

    if (!result.ok) {
      if (
        requestGeneration === authGeneration
        && requestIdentity === getCueStorageIdentity()
      ) {
        memberNotice = result.payload.message || "그룹 큐시트를 불러오지 못했습니다.";
      }
      return;
    }

    if (
      requestGeneration !== authGeneration
      || requestIdentity !== getCueStorageIdentity()
      || !authSession.authenticated
    ) {
      return;
    }

    const nextCues = normalizeCueCollection(result.payload.cue?.items);

    stopMetronome();
    cues = cloneCues(nextCues);
    render();
    memberNotice = "그룹 큐시트를 현재 목록으로 불러왔습니다.";
  } catch {
    if (
      requestGeneration === authGeneration
      && requestIdentity === getCueStorageIdentity()
    ) {
      memberNotice = "그룹 큐시트를 불러오지 못했습니다.";
    }
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function deleteMemberGroupCue(cueId) {
  if (!authSession.authenticated || memberActionInFlight || !selectedMemberGroupId || !cueId) {
    return;
  }

  const confirmed = window.confirm("그룹 큐시트를 삭제할까요? owner만 삭제할 수 있습니다.");

  if (!confirmed) {
    return;
  }

  memberActionInFlight = true;
  memberNotice = "그룹 큐시트를 삭제하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchGroupJson(`${selectedMemberGroupId}/cues/${cueId}`, {
      method: "DELETE",
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "그룹 큐시트를 삭제하지 못했습니다.";
      return;
    }

    await loadMemberGroupDetail(selectedMemberGroupId, { silent: true });
    memberNotice = "그룹 큐시트를 삭제했습니다.";
  } catch {
    memberNotice = "그룹 큐시트를 삭제하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function sendMemberGroupNotice() {
  if (!authSession.authenticated || memberActionInFlight || !selectedMemberGroupId) {
    return;
  }

  const title = String(memberGroupNoticeTitleInput?.value || "").trim();
  const body = String(memberGroupNoticeBodyInput?.value || "").trim();

  if (!title) {
    memberNotice = "공지 제목을 입력해 주세요.";
    updateMemberUi();
    memberGroupNoticeTitleInput?.focus();
    return;
  }

  memberActionInFlight = true;
  memberNotice = "그룹 공지를 보내는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchGroupJson(`${selectedMemberGroupId}/messages`, {
      method: "POST",
      body: {
        title,
        body,
      },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "그룹 공지를 보내지 못했습니다.";
      return;
    }

    if (memberGroupNoticeTitleInput) {
      memberGroupNoticeTitleInput.value = "";
    }
    if (memberGroupNoticeBodyInput) {
      memberGroupNoticeBodyInput.value = "";
    }

    await loadMemberGroupDetail(selectedMemberGroupId, { silent: true });
    await loadMemberWorkspace();
    memberNotice = "그룹 공지를 보냈습니다.";
  } catch {
    memberNotice = "그룹 공지를 보내지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function createMemberPerformance() {
  if (!authSession.authenticated || memberActionInFlight || !selectedMemberGroupId) {
    return;
  }

  const title = String(memberPerformanceTitleInput?.value || "").trim();

  if (!title) {
    memberNotice = "공연명을 입력해 주세요.";
    updateMemberUi();
    memberPerformanceTitleInput?.focus();
    return;
  }

  memberActionInFlight = true;
  memberNotice = "공연을 추가하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchPerformanceJson("create", {
      method: "POST",
      body: {
        groupId: selectedMemberGroupId,
        title,
        performanceDate: memberPerformanceDateInput?.value || "",
        location: memberPerformanceLocationInput?.value || "",
        memo: memberPerformanceMemoInput?.value || "",
      },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "공연을 추가하지 못했습니다.";
      return;
    }

    memberPerformanceForm?.reset();
    await loadMemberGroupDetail(selectedMemberGroupId, { silent: true });
    memberNotice = "공연을 추가했습니다.";
  } catch {
    memberNotice = "공연을 추가하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function attachMemberPerformanceCue() {
  if (!authSession.authenticated || memberActionInFlight || !selectedMemberGroupId) {
    return;
  }

  const performanceId = String(memberPerformanceSelect?.value || "").trim();
  const groupCueId = String(memberPerformanceCueSelect?.value || "").trim();

  if (!performanceId) {
    memberNotice = "큐시트를 연결할 공연을 선택해 주세요.";
    updateMemberUi();
    return;
  }

  if (!groupCueId) {
    memberNotice = "공연에 연결할 그룹 큐시트를 선택해 주세요.";
    updateMemberUi();
    return;
  }

  memberActionInFlight = true;
  memberNotice = "공연에 큐시트를 연결하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchPerformanceJson(`${performanceId}/cues`, {
      method: "POST",
      body: {
        groupCueId,
      },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "공연에 큐시트를 연결하지 못했습니다.";
      return;
    }

    await loadMemberGroupDetail(selectedMemberGroupId, { silent: true });
    memberNotice = "공연에 큐시트를 연결했습니다.";
  } catch {
    memberNotice = "공연에 큐시트를 연결하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function loadMemberPerformanceCueLinks(performances) {
  if (!performances.length) {
    return {};
  }

  const entries = await Promise.all(performances.map(async (performance) => {
    try {
      const result = await fetchPerformanceJson(`${performance.id}/cues`);

      if (!result.ok) {
        return [performance.id, []];
      }

      return [performance.id, normalizeMemberPerformanceCueLinks(result.payload.cues)];
    } catch {
      return [performance.id, []];
    }
  }));

  return Object.fromEntries(entries);
}

async function saveMemberMemo() {
  if (!authSession.authenticated || memberActionInFlight) {
    return;
  }

  memberActionInFlight = true;
  memberNotice = "메모를 저장하는 중입니다.";
  updateMemberUi();

  try {
    const result = await fetchMemberJson("memo", {
      method: "PUT",
      body: {
        content: memberMemoInput?.value || "",
      },
    });

    if (!result.ok) {
      memberNotice = result.payload.message || "메모를 저장하지 못했습니다.";
      return;
    }

    if (memberMemoInput) {
      memberMemoInput.value = String(result.payload.content || "");
    }

    memberNotice = "메모를 저장했습니다.";
  } catch {
    memberNotice = "메모를 저장하지 못했습니다.";
  } finally {
    memberActionInFlight = false;
    updateMemberUi();
  }
}

async function fetchMemberJson(path, { method = "GET", body } = {}) {
  const headers = {
    Accept: "application/json",
  };
  const options = {
    method,
    headers,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${MEMBER_API_ENDPOINT}/${path}`, options);
  const payload = await safeReadJson(response);

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function fetchGroupJson(path, { method = "GET", body } = {}) {
  return fetchJsonFromEndpoint(`${GROUPS_API_ENDPOINT}/${path}`, { method, body });
}

async function fetchPerformanceJson(path, { method = "GET", body } = {}) {
  return fetchJsonFromEndpoint(`${PERFORMANCES_API_ENDPOINT}/${path}`, { method, body });
}

async function fetchJsonFromEndpoint(url, { method = "GET", body } = {}) {
  const headers = {
    Accept: "application/json",
  };
  const options = {
    method,
    headers,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const payload = await safeReadJson(response);

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

function normalizeMemberGroups(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((group) => ({
      id: String(group?.id || ""),
      name: String(group?.name || "").trim(),
      role: group?.role === "owner" ? "owner" : "member",
      memberCount: Number(group?.memberCount || 0),
      updatedAt: group?.updatedAt || null,
    }))
    .filter((group) => group.id && group.name);
}

function normalizeMemberDashboard(value) {
  return {
    cueCount: Number(value?.cueCount || 0),
    practiceDayCount: Number(value?.practiceDayCount || 0),
    practiceTotalMinutes: Number(value?.practiceTotalMinutes || 0),
    todoCount: Number(value?.todoCount || 0),
    unreadMessageCount: Number(value?.unreadMessageCount || 0),
    groupCount: Number(value?.groupCount || 0),
  };
}

function normalizeMemberMessages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((message) => ({
      id: String(message?.id || ""),
      type: message?.type === "group_message" ? "group_message" : "invite",
      messageType: String(message?.messageType || ""),
      groupId: String(message?.groupId || ""),
      groupName: String(message?.groupName || "").trim(),
      title: String(message?.title || "").trim(),
      body: String(message?.body || "").trim(),
      inviterEmail: normalizeEmail(message?.inviterEmail),
      inviterName: String(message?.inviterName || "").trim(),
      status: ["pending", "accepted", "rejected", "notice"].includes(message?.status)
        ? message.status
        : String(message?.status || ""),
      isRead: Boolean(message?.isRead),
      createdAt: message?.createdAt || null,
    }))
    .filter((message) => message.id);
}

function normalizeMemberGroupDetail(value) {
  return {
    id: String(value?.id || ""),
    name: String(value?.name || "").trim(),
    description: String(value?.description || "").trim(),
    role: value?.role === "owner" ? "owner" : "member",
    memberCount: Number(value?.memberCount || 0),
    updatedAt: value?.updatedAt || null,
  };
}

function normalizeMemberGroupMembers(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((member) => ({
      id: String(member?.id || ""),
      email: normalizeEmail(member?.email),
      name: String(member?.name || "").trim(),
      region: String(member?.region || "").trim(),
      position: String(member?.position || "").trim(),
      genre: String(member?.genre || "").trim(),
      pictureUrl: String(member?.pictureUrl || "").trim(),
      role: member?.role === "owner" ? "owner" : "member",
    }))
    .filter((member) => member.id);
}

function normalizeMemberGroupCues(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((cue) => ({
      id: String(cue?.id || ""),
      title: String(cue?.title || "").trim(),
      itemCount: Number(cue?.itemCount || 0),
      durationSeconds: Number(cue?.durationSeconds || 0),
      updatedAt: cue?.updatedAt || null,
    }))
    .filter((cue) => cue.id && cue.title);
}

function normalizeMemberGroupMessages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((message) => ({
      id: String(message?.id || ""),
      title: String(message?.title || "").trim(),
      body: String(message?.body || "").trim(),
      isRead: Boolean(message?.isRead),
      createdAt: message?.createdAt || null,
    }))
    .filter((message) => message.id);
}

function normalizeMemberPerformances(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((performance) => ({
      id: String(performance?.id || ""),
      title: String(performance?.title || "").trim(),
      performanceDate: String(performance?.performanceDate || "").trim(),
      location: String(performance?.location || "").trim(),
      memo: String(performance?.memo || "").trim(),
      updatedAt: performance?.updatedAt || null,
    }))
    .filter((performance) => performance.id && performance.title);
}

function normalizeMemberPerformanceCueLinks(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((cue) => ({
      id: String(cue?.id || ""),
      groupCueId: String(cue?.groupCueId || ""),
      title: String(cue?.title || "").trim(),
      sortOrder: Number(cue?.sortOrder || 0),
    }))
    .filter((cue) => cue.id && cue.groupCueId);
}

function normalizeMemberProfile(value) {
  return {
    email: normalizeEmail(value?.email),
    name: String(value?.name || "").trim(),
    pictureUrl: String(value?.pictureUrl || "").trim(),
    region: String(value?.region || "").trim(),
    position: String(value?.position || "").trim(),
    genre: String(value?.genre || "").trim(),
    memo: String(value?.memo || "").trim(),
  };
}

function normalizeMemberDirectory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((member) => ({
      id: String(member?.id || ""),
      name: String(member?.name || "").trim() || "이름 없는 회원",
      pictureUrl: String(member?.pictureUrl || "").trim(),
      region: String(member?.region || "").trim(),
      position: String(member?.position || "").trim(),
      genre: String(member?.genre || "").trim(),
      memo: String(member?.memo || "").trim(),
    }))
    .filter((member) => member.id);
}

function isValidProfileUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());

    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
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

    setAuthSession(normalizeAuthSession({
      ...payload,
      databaseConfigured: true,
      googleLoginConfigured: true,
      emailLoginConfigured: authSession.emailLoginConfigured,
      googleClientId: authSession.googleClientId,
    }));
    authNotice = "로그인되었습니다.";
    broadcastAuthSessionChange();
    await reloadAuthenticatedWorkspace();
  } catch {
    authNotice = "로그인 처리를 완료하지 못했습니다.";
  } finally {
    authInFlight = false;
    updateAuthUi();
  }
}

async function loginWithEmailPassword() {
  if (emailAuthInFlight || authSession.authenticated) {
    return;
  }

  const email = normalizeEmail(emailAuthInput?.value || "");
  const password = String(emailPasswordInput?.value || "");

  if (!isValidEmail(email) || !password) {
    authNotice = "이메일과 비밀번호를 입력해 주세요.";
    updateAuthUi();
    (isValidEmail(email) ? emailPasswordInput : emailAuthInput)?.focus();
    return;
  }

  emailAuthInFlight = true;
  authNotice = "로그인하는 중입니다.";
  updateAuthUi();

  try {
    const response = await fetch(AUTH_LOGIN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const payload = await safeReadJson(response);

    if (!response.ok) {
      authNotice = payload.message || "로그인하지 못했습니다.";
      return;
    }

    setAuthSession(normalizeAuthSession({
      ...payload,
      databaseConfigured: true,
      googleLoginConfigured: authSession.googleLoginConfigured,
      emailLoginConfigured: true,
      googleClientId: authSession.googleClientId,
    }));
    emailPasswordInput.value = "";
    authNotice = "로그인되었습니다.";
    broadcastAuthSessionChange();
    await reloadAuthenticatedWorkspace();
  } catch {
    authNotice = "로그인 요청을 완료하지 못했습니다.";
  } finally {
    emailAuthInFlight = false;
    updateAuthUi();
  }
}

async function logoutAuthSession() {
  if (authInFlight) {
    return;
  }

  if (hasCueEditor && hasPendingChanges()) {
    const confirmed = window.confirm("저장되지 않은 변경사항이 있습니다. 로그아웃하시겠습니까?");

    if (!confirmed) {
      return;
    }
  }

  authInFlight = true;
  authNotice = "로그아웃하는 중입니다.";
  updateAuthUi();

  try {
    let response = null;

    try {
      response = await fetch(AUTH_LOGOUT_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (networkError) {
      const verifiedSession = await loadAuthSession();

      if (!verifiedSession.resolved || verifiedSession.authenticated) {
        throw networkError;
      }
    }

    const payload = response ? await safeReadJson(response) : {};

    if (response && !response.ok) {
      const verifiedSession = await loadAuthSession();

      if (!verifiedSession.resolved || verifiedSession.authenticated) {
        throw new Error(payload.message || "로그아웃하지 못했습니다.");
      }
    }

    setAuthSession({
      resolved: true,
      authenticated: false,
      userId: "",
      email: "",
      databaseConfigured: authSession.databaseConfigured,
      googleLoginConfigured: authSession.googleLoginConfigured,
      emailLoginConfigured: authSession.emailLoginConfigured,
      googleClientId: authSession.googleClientId,
      message: "",
    });
    authNotice = "로그아웃되었습니다.";
    broadcastAuthSessionChange();
    window.google?.accounts?.id?.disableAutoSelect();
    clearUserScopedLocalCaches();
    savedCues = [];
    cues = [];
    practiceLogs = {};
    todoUserScoped = false;
    todoEditUnlocked = false;
    todoEditPassword = "";
    todoLastSavedHtml = "";
    todoNeedsInitialDbSave = false;
    render();
    renderPracticeCalendar();
    resetMemberWorkspace();
    await Promise.all([
      initializePracticeTracker(),
      initializeStorage(),
      loadTodoDocument(),
    ]);
  } catch (error) {
    authNotice = error instanceof Error && error.message
      ? error.message
      : "로그아웃 요청을 완료하지 못했습니다.";
  } finally {
    authInFlight = false;
    updateAuthUi();
  }
}

function normalizeAuthSession(value) {
  const rawAuthenticated = Boolean(value?.authenticated);
  const rawUserId = rawAuthenticated ? String(value?.userId || "").trim() : "";
  const resolved = value?.resolved !== false && (!rawAuthenticated || Boolean(rawUserId));
  const authenticated = resolved && rawAuthenticated;
  const userId = authenticated ? rawUserId : "";

  return {
    resolved,
    authenticated,
    userId,
    email: normalizeEmail(value?.email),
    databaseConfigured: Boolean(value?.databaseConfigured),
    googleLoginConfigured: Boolean(value?.googleLoginConfigured),
    emailLoginConfigured: Boolean(value?.emailLoginConfigured),
    googleClientId: String(value?.googleClientId || "").trim(),
    message: typeof value?.message === "string" ? value.message : "",
  };
}

function setAuthSession(value) {
  const nextSession = normalizeAuthSession(value);
  const previousFingerprint = getAuthSessionFingerprint(authSession);
  const nextFingerprint = getAuthSessionFingerprint(nextSession);

  authSession = nextSession;

  if (previousFingerprint !== nextFingerprint) {
    authGeneration += 1;
    cueStorageLoadVersion += 1;
  }

  return previousFingerprint !== nextFingerprint;
}

function getAuthSessionFingerprint(session) {
  return [
    session?.resolved ? "resolved" : "unknown",
    session?.authenticated ? "authenticated" : "anonymous",
    String(session?.userId || ""),
  ].join(":");
}

function createUnknownAuthSession(message, value = {}) {
  return normalizeAuthSession({
    ...value,
    resolved: false,
    authenticated: false,
    userId: null,
    email: "",
    message,
  });
}

function getCueStorageIdentity(session = authSession) {
  if (!session?.resolved) {
    return "";
  }

  if (!session.authenticated) {
    return "anonymous";
  }

  const userId = String(session.userId || "").trim();

  return userId ? `user:${userId}` : "";
}

function remoteCueScopeMatches(result, storageIdentity) {
  if (storageIdentity === "anonymous") {
    return result.authenticated === false
      && result.userScoped === false
      && !result.userId;
  }

  if (!storageIdentity.startsWith("user:")) {
    return false;
  }

  return result.authenticated === true
    && result.userScoped === true
    && result.userId === storageIdentity.slice(5);
}

async function verifyCueSaveSession(expectedIdentity) {
  const verificationGeneration = authGeneration;
  const latestSession = await loadAuthSession();

  if (
    verificationGeneration !== authGeneration
    || expectedIdentity !== getCueStorageIdentity()
  ) {
    return {
      ok: false,
      message: "저장 확인 중 로그인 상태가 변경되어 저장하지 않았습니다.",
    };
  }

  if (!latestSession.resolved) {
    lockCueStorageForUnknownSession(latestSession);
    return {
      ok: false,
      message: latestSession.message || "로그인 상태를 확인하지 못해 저장하지 않았습니다.",
    };
  }

  const latestIdentity = getCueStorageIdentity(latestSession);

  if (latestIdentity !== expectedIdentity) {
    await reloadWorkspaceForAuthSession(
      latestSession,
      "다른 로그인 계정이 확인되어 해당 계정의 목록을 다시 불러왔습니다.",
    );
    return {
      ok: false,
      message: "로그인 계정이 변경되어 이전 화면의 목록을 저장하지 않았습니다.",
    };
  }

  setAuthSession(latestSession);
  updateAuthUi();
  return { ok: true, message: "" };
}

async function refreshWorkspaceAfterCueSessionChange() {
  const refreshGeneration = authGeneration;
  const latestSession = await loadAuthSession();

  if (refreshGeneration !== authGeneration) {
    return;
  }

  if (!latestSession.resolved) {
    lockCueStorageForUnknownSession(latestSession);
    return;
  }

  await reloadWorkspaceForAuthSession(
    latestSession,
    "로그인 상태가 변경되어 현재 계정의 목록을 다시 불러왔습니다.",
  );
}

async function reloadWorkspaceForAuthSession(nextSession, notice) {
  const previousIdentity = getCueStorageIdentity();

  setAuthSession(nextSession);
  authNotice = notice;
  updateAuthUi();

  if (previousIdentity !== getCueStorageIdentity() || !authSession.authenticated) {
    resetMemberWorkspace();
  }

  await Promise.all([
    initializeStorage(),
    initializePracticeTracker(),
    loadTodoDocument(),
    loadMemberDirectory(),
    authSession.authenticated ? loadMemberWorkspace() : Promise.resolve(),
  ]);
}

function lockCueStorageForUnknownSession(nextSession) {
  setAuthSession(nextSession);
  setCueStorageDisplayLocked(true);
  authNotice = nextSession.message || "로그인 상태를 다시 확인해 주세요.";
  storageMode = STORAGE_MODE_LOCAL;
  storageWarningMessage = "로그인 상태를 확인할 때까지 개인 큐시트 저장을 잠갔습니다.";
  updateAuthUi();
  updateActionState();
}

function setCueStorageDisplayLocked(locked) {
  cueStorageDisplayLocked = Boolean(locked);

  if (cueEditorPanel) {
    cueEditorPanel.hidden = cueStorageDisplayLocked;
  }
  if (cueListPanel) {
    cueListPanel.hidden = cueStorageDisplayLocked;
  }
  if (cueStorageDisplayLocked) {
    closeCueEntryOverlay({ restoreFocus: false });
  }
}

function setupAuthCoordination() {
  if (typeof window.BroadcastChannel === "function") {
    try {
      authChannel = new window.BroadcastChannel(AUTH_CHANNEL_NAME);
      authChannel.addEventListener("message", (event) => {
        if (event.data?.type === "session-changed") {
          refreshAuthSessionOnResume();
        }
      });
    } catch {
      authChannel = null;
    }
  }

  window.addEventListener("focus", () => {
    refreshAuthSessionOnResume();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === AUTH_STORAGE_EVENT_KEY) {
      refreshAuthSessionOnResume();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") {
      refreshAuthSessionOnResume();
    }
  });
}

function broadcastAuthSessionChange() {
  try {
    authChannel?.postMessage({ type: "session-changed" });
  } catch {
    authChannel = null;
  }

  try {
    window.localStorage.setItem(AUTH_STORAGE_EVENT_KEY, `${Date.now()}-${Math.random()}`);
    window.localStorage.removeItem(AUTH_STORAGE_EVENT_KEY);
  } catch {
    return;
  }
}

async function refreshAuthSessionOnResume() {
  const now = Date.now();

  if (!authCoordinationReady) {
    authRefreshPending = true;
    return;
  }

  if (authRefreshInFlight || authInFlight || emailAuthInFlight || saveInFlight) {
    scheduleAuthSessionRefresh(250);
    return;
  }

  if (now - lastAuthRefreshAt < 500) {
    scheduleAuthSessionRefresh(500 - (now - lastAuthRefreshAt));
    return;
  }

  authRefreshPending = false;
  authRefreshInFlight = true;
  lastAuthRefreshAt = now;
  const refreshGeneration = authGeneration;
  const previousIdentity = getCueStorageIdentity();

  try {
    const latestSession = await loadAuthSession();

    if (refreshGeneration !== authGeneration) {
      authRefreshPending = true;
      return;
    }

    if (!latestSession.resolved) {
      lockCueStorageForUnknownSession(latestSession);
      return;
    }

    const latestIdentity = getCueStorageIdentity(latestSession);

    if (latestIdentity !== previousIdentity) {
      await reloadWorkspaceForAuthSession(
        latestSession,
        "로그인 계정이 변경되어 현재 계정의 목록을 불러왔습니다.",
      );
      return;
    }

    setAuthSession(latestSession);
    updateAuthUi();
  } finally {
    authRefreshInFlight = false;

    if (authRefreshPending) {
      scheduleAuthSessionRefresh();
    }
  }
}

function scheduleAuthSessionRefresh(delay = 0) {
  authRefreshPending = true;

  if (authRefreshTimer !== null) {
    return;
  }

  const throttleDelay = Math.max(0, 500 - (Date.now() - lastAuthRefreshAt));

  authRefreshTimer = window.setTimeout(() => {
    authRefreshTimer = null;
    refreshAuthSessionOnResume();
  }, Math.max(delay, throttleDelay));
}

function loadLocalCues() {
  try {
    window.localStorage.removeItem(LEGACY_ANONYMOUS_STORAGE_KEY);
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

function clearUserScopedLocalCaches() {
  try {
    window.localStorage.removeItem(ANONYMOUS_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_ANONYMOUS_STORAGE_KEY);
    window.localStorage.removeItem(PRACTICE_LOG_STORAGE_KEY);
  } catch {
    return;
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
      authenticated: payload.authenticated === true,
      userScoped: payload.userScoped === true,
      userId: payload.userId == null ? "" : String(payload.userId),
    };
  } catch {
    return {
      ok: false,
      databaseConfigured: true,
      message: "DB에 연결할 수 없어 로컬 캐시만 사용합니다.",
    };
  }
}

async function persistRemoteCues(items, password, expectedUserId) {
  try {
    const response = await fetch(CUES_API_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ items, password, expectedUserId }),
    });
    const payload = await safeReadJson(response);

    return {
      ok: response.ok,
      code: String(payload.error || ""),
      message: payload.message || "",
      authenticated: payload.authenticated === true,
      userScoped: payload.userScoped === true,
      userId: payload.userId == null ? "" : String(payload.userId),
    };
  } catch {
    return {
      ok: false,
      code: "network_error",
      message: "저장 요청을 완료하지 못했습니다.",
    };
  }
}

async function persistCurrentCues(items, password, storageIdentity) {
  const nextItems = normalizeCueCollection(items);
  const isAnonymousStorage = storageIdentity === "anonymous";
  const localSaved = isAnonymousStorage ? persistLocalCues(nextItems) : true;

  if (!storageIdentity || storageIdentity !== getCueStorageIdentity()) {
    return {
      ok: false,
      code: "session_changed",
      message: "로그인 계정이 변경되어 저장하지 않았습니다.",
    };
  }

  if (storageMode !== STORAGE_MODE_DATABASE) {
    return {
      ok: isAnonymousStorage && localSaved,
      code: isAnonymousStorage && localSaved ? "" : "database_unavailable",
      message: isAnonymousStorage && localSaved
        ? ""
        : "개인 큐시트를 저장할 DB 연결을 확인해 주세요.",
    };
  }

  const expectedUserId = storageIdentity.startsWith("user:")
    ? storageIdentity.slice(5)
    : "";
  const remoteSaved = await persistRemoteCues(nextItems, password, expectedUserId);

  if (!remoteSaved.ok) {
    return {
      ok: false,
      code: remoteSaved.code,
      message: remoteSaved.message,
    };
  }

  if (!remoteCueScopeMatches(remoteSaved, storageIdentity)) {
    return {
      ok: false,
      code: "session_changed",
      message: "저장 응답의 로그인 계정이 달라 목록을 다시 확인합니다.",
    };
  }

  return {
    ok: localSaved,
    code: "",
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

  if (cueList && cueItemTemplate) {
    cueList.innerHTML = "";

    if (emptyState) {
      emptyState.hidden = cues.length > 0;
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
  }

  const formattedTotalDuration = formatDuration(
    cues.reduce((sum, cue) => sum + cue.seconds, 0),
  );

  if (totalDuration) {
    totalDuration.textContent = formattedTotalDuration;
  }

  if (cueModalTotalDuration) {
    cueModalTotalDuration.textContent = formattedTotalDuration;
  }

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
  if (bpmInput) {
    bpmInput.value = measuredTapBpm;
  }
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
  if (!cueList) {
    return;
  }

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
  const storageIdentity = getCueStorageIdentity();

  if (storageMode !== STORAGE_MODE_LOADING && storageIdentity === "anonymous" && hasCueEditor) {
    persistLocalCues(cues);
  }

  const dirty = hasPendingChanges();
  const needsAttention = dirty || databaseSeedRequired;
  const canSaveToDatabase = storageMode === STORAGE_MODE_DATABASE && !cueStorageDisplayLocked;
  const isPersonalStorage = storageIdentity.startsWith("user:");

  if (saveButton) {
    saveButton.disabled = !canSaveToDatabase || saveInFlight || !dirty;
    saveButton.textContent = isPersonalStorage ? "내 목록 저장하기" : "목록 저장하기";
  }
  if (clearAllButton) {
    clearAllButton.disabled = cueStorageDisplayLocked
      || storageMode === STORAGE_MODE_LOADING
      || saveInFlight
      || cues.length === 0;
  }
  if (!saveStatus) {
    return;
  }

  saveStatus.classList.toggle("is-dirty", needsAttention);
  saveStatus.classList.toggle(
    "is-error",
    storageMode === STORAGE_MODE_LOCAL && Boolean(storageWarningMessage),
  );

  if (!hasCueEditor) {
    if (saveButton) {
      saveButton.disabled = true;
    }
    if (clearAllButton) {
      clearAllButton.disabled = true;
    }
    saveStatus.classList.remove("is-dirty", "is-error");

    if (storageMode === STORAGE_MODE_LOADING) {
      saveStatus.textContent = "저장된 큐시트를 불러오는 중입니다.";
      return;
    }

    if (!databaseConfigured) {
      saveStatus.textContent = "DB 연결이 아직 설정되지 않았습니다.";
      return;
    }

    saveStatus.textContent = cues.length
      ? "현재 저장된 큐시트를 표시합니다. 생성과 편집은 목록 페이지에서 진행합니다."
      : "저장된 큐시트가 없습니다. 목록 페이지에서 새로 만들 수 있습니다.";
    return;
  }

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
    saveStatus.textContent = isPersonalStorage
      ? "개인 저장소 연결에 문제가 있어 현재 변경사항을 저장할 수 없습니다."
      : "DB 연결에 문제가 있어 현재 작업은 이 브라우저에만 남습니다.";
    return;
  }

  saveStatus.textContent = storageWarningMessage || (isPersonalStorage
    ? "개인 큐시트 저장소에 연결하지 못했습니다."
    : "DB 연결에 문제가 있어 브라우저 캐시만 사용 중입니다.");
}

function restorePendingTapBpm() {
  if (!hasCueEditor) {
    return;
  }

  let pendingBpm = "";

  try {
    pendingBpm = normalizeBpm(window.sessionStorage.getItem(PENDING_TAP_BPM_STORAGE_KEY));
    window.sessionStorage.removeItem(PENDING_TAP_BPM_STORAGE_KEY);
  } catch {
    pendingBpm = "";
  }

  if (!pendingBpm) {
    return;
  }

  window.requestAnimationFrame(() => {
    openCueEntryOverlay({
      resetForm: false,
      type: CUE_TYPE_SONG,
      restoreTarget: openCueEntryButton,
    });

    if (bpmInput) {
      bpmInput.value = pendingBpm;
      bpmInput.focus();
      bpmInput.select();
    }
  });
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

function updateMemberUi() {
  if (!memberPanel) {
    return;
  }

  const isLoggedIn = authSession.authenticated;
  const isBusy = memberWorkspaceInFlight || memberActionInFlight;
  const ownerGroups = isLoggedIn
    ? memberGroups.filter((group) => group.role === "owner")
    : [];
  const canInvite = isLoggedIn && ownerGroups.length > 0 && !isBusy;

  memberPanel.classList.toggle("is-locked", !isLoggedIn);

  if (memberStatus) {
    if (!isLoggedIn) {
      memberStatus.textContent = "로그인 후 사용할 수 있습니다.";
    } else {
      memberStatus.textContent = memberNotice || "회원 데이터를 계정 기준으로 관리합니다.";
    }

    memberStatus.classList.remove("is-error");
  }

  if (memberProfileModalStatus) {
    memberProfileModalStatus.textContent = !isLoggedIn
      ? "로그인 후 프로필을 관리할 수 있습니다."
      : memberNotice || "프로필 정보를 확인하고 수정할 수 있습니다.";
  }

  if (memberGroupModalStatus) {
    memberGroupModalStatus.textContent = !isLoggedIn
      ? "로그인 후 그룹 작업을 사용할 수 있습니다."
      : memberNotice || "그룹을 선택하면 오른쪽에 상세 정보가 표시됩니다.";
  }

  if (memberGroupNameInput) {
    memberGroupNameInput.disabled = !isLoggedIn || isBusy;
  }
  if (memberGroupForm?.querySelector("button")) {
    memberGroupForm.querySelector("button").disabled = !isLoggedIn || isBusy;
  }

  renderMemberDashboard(isLoggedIn);
  renderMemberGroups(isLoggedIn);
  renderMemberInviteSelect(ownerGroups);

  if (memberInviteGroupSelect) {
    memberInviteGroupSelect.disabled = !canInvite;
  }
  if (memberInviteEmailInput) {
    memberInviteEmailInput.disabled = !canInvite;
  }
  if (memberInviteButton) {
    memberInviteButton.disabled = !canInvite;
  }

  renderMemberMessages(isLoggedIn, isBusy);
  renderMemberGroupDetail(isLoggedIn, isBusy || memberGroupDetailInFlight);
  setMemberProfileDisabled(!isLoggedIn || isBusy);

  for (const trigger of memberModalTriggers) {
    trigger.disabled = !isLoggedIn || isBusy;
  }

  if (memberMemoInput) {
    memberMemoInput.disabled = !isLoggedIn || isBusy;
  }
  if (memberMemoSaveButton) {
    memberMemoSaveButton.disabled = !isLoggedIn || isBusy;
  }
}

function renderMemberDashboard(isLoggedIn) {
  if (!memberDashboardList) {
    return;
  }

  memberDashboardList.replaceChildren();

  if (!isLoggedIn) {
    memberDashboardList.appendChild(createMemberEmptyItem("로그인 후 회원 홈을 확인할 수 있습니다."));
    return;
  }

  const dashboard = memberDashboard || normalizeMemberDashboard();
  const userLabel = [
    memberProfile?.name || "",
    authSession.email,
  ].filter(Boolean).join(" · ");
  const items = [
    ["로그인 사용자", userLabel || "계정 확인 중"],
    ["내 큐시트", `${dashboard.cueCount}개`],
    ["연습 기록", `${dashboard.practiceDayCount}일 · ${formatMinutesLabel(dashboard.practiceTotalMinutes)}`],
    ["내 할 일", `${dashboard.todoCount}개`],
    ["안읽은 메시지", `${dashboard.unreadMessageCount}개`],
    ["내 그룹", `${dashboard.groupCount}개`],
  ];

  for (const [label, value] of items) {
    const item = document.createElement("li");
    const title = document.createElement("span");
    const count = document.createElement("strong");

    item.className = "member-dashboard-item";
    title.textContent = label;
    count.textContent = value;
    item.append(title, count);
    memberDashboardList.appendChild(item);
  }
}

function renderMemberDirectory() {
  if (!memberDirectoryList) {
    return;
  }

  if (!memberDirectory.length) {
    return;
  }

  memberDirectoryList.replaceChildren(...memberDirectory.map(createDirectoryItem));
}

function createDirectoryItem(member) {
  const item = document.createElement("article");
  const main = document.createElement("div");
  const title = document.createElement("strong");
  const meta = document.createElement("p");
  const memo = document.createElement("small");
  const avatar = createMemberAvatar(member);
  const metaText = [member.position, member.region, member.genre].filter(Boolean).join(" · ");

  item.className = "directory-item";
  title.textContent = member.name;
  meta.textContent = metaText || "프로필 준비 중";
  memo.textContent = member.memo || "소개가 아직 없습니다.";

  main.append(title, meta, memo);
  item.append(avatar, main);
  return item;
}

function createMemberAvatar(member) {
  if (member.pictureUrl) {
    const image = document.createElement("img");

    image.className = "directory-avatar directory-avatar-image";
    image.src = member.pictureUrl;
    image.alt = `${member.name} 프로필사진`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    return image;
  }

  const avatar = document.createElement("span");

  avatar.className = "directory-avatar";
  avatar.textContent = getProfileInitial(member.name);
  return avatar;
}

function syncMemberProfileForm() {
  const profile = memberProfile || {};
  const name = profile.name || "";
  const pictureUrl = profile.pictureUrl || "";

  if (memberProfileNameInput) {
    memberProfileNameInput.value = name;
  }
  if (memberProfileEmailInput) {
    memberProfileEmailInput.value = profile.email || authSession.email || "";
  }
  if (memberProfileRegionInput) {
    memberProfileRegionInput.value = profile.region || "";
  }
  if (memberProfilePositionInput) {
    memberProfilePositionInput.value = profile.position || "";
  }
  if (memberProfileGenreInput) {
    memberProfileGenreInput.value = profile.genre || "";
  }
  if (memberProfilePictureInput) {
    memberProfilePictureInput.value = pictureUrl;
  }
  if (memberProfileMemoInput) {
    memberProfileMemoInput.value = profile.memo || "";
  }

  renderMemberProfilePreview({ name, pictureUrl });
}

function renderMemberProfilePreview(profile) {
  const name = profile?.name || authSession.email || "M";
  const pictureUrl = profile?.pictureUrl || "";

  if (memberProfileInitial) {
    memberProfileInitial.textContent = getProfileInitial(name);
    memberProfileInitial.hidden = Boolean(pictureUrl);
  }
  if (memberProfileImage) {
    memberProfileImage.hidden = !pictureUrl;
    memberProfileImage.src = pictureUrl || "";
  }
}

function setMemberProfileDisabled(disabled) {
  for (const input of [
    memberProfileNameInput,
    memberProfileRegionInput,
    memberProfilePositionInput,
    memberProfileGenreInput,
    memberProfilePictureInput,
    memberProfileMemoInput,
  ]) {
    if (input) {
      input.disabled = disabled;
    }
  }

  if (memberProfileSaveButton) {
    memberProfileSaveButton.disabled = disabled;
  }
  if (memberProfilePictureButton) memberProfilePictureButton.disabled = disabled;
  if (memberProfilePictureRemoveButton) memberProfilePictureRemoveButton.disabled = disabled || !memberProfile?.pictureUrl;
}

function getProfileInitial(value) {
  const text = String(value || "").trim();

  return (text[0] || "M").toUpperCase();
}

function renderMemberGroups(isLoggedIn) {
  if (!memberGroupList) {
    return;
  }

  const focusedGroupId = document.activeElement
    ?.closest?.("[data-member-group-detail]")
    ?.dataset.memberGroupDetail;
  const focusGroupId = pendingMemberGroupFocusId || focusedGroupId;
  let focusTarget = null;

  memberGroupList.replaceChildren();
  memberGroupList.setAttribute("aria-busy", String(memberGroupDetailInFlight));

  if (!isLoggedIn) {
    memberGroupList.appendChild(createMemberEmptyItem("로그인 후 그룹을 확인할 수 있습니다."));
    return;
  }

  if (!memberGroups.length) {
    memberGroupList.appendChild(createMemberEmptyItem("그룹이 없습니다."));
    return;
  }

  for (const group of memberGroups) {
    const item = document.createElement("li");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const actions = document.createElement("div");
    const role = document.createElement("span");

    item.className = "member-list-item";
    item.classList.toggle("is-selected", group.id === selectedMemberGroupId);
    item.dataset.memberGroupDetail = group.id;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(group.id === selectedMemberGroupId));
    item.tabIndex = group.id === selectedMemberGroupId ? 0 : -1;
    if (group.id === focusGroupId) {
      focusTarget = item;
    }
    main.className = "member-list-main";
    title.textContent = group.name;
    meta.textContent = [
      group.memberCount ? `멤버 ${group.memberCount}명` : "",
      formatMemberDate(group.updatedAt),
    ].filter(Boolean).join(" · ");
    actions.className = "member-list-actions";
    role.className = "member-pill";
    role.textContent = group.role === "owner" ? "owner" : "member";

    main.append(title, meta);
    actions.append(role);
    item.append(main, actions);
    memberGroupList.appendChild(item);
  }

  if (focusTarget) {
    window.requestAnimationFrame(() => {
      if (!focusTarget.isConnected) return;
      focusTarget.focus();
      if (pendingMemberGroupFocusId === focusTarget.dataset.memberGroupDetail) {
        pendingMemberGroupFocusId = "";
      }
    });
  }
}

function renderMemberInviteSelect(ownerGroups) {
  if (!memberInviteGroupSelect) {
    return;
  }

  memberInviteGroupSelect.replaceChildren();

  if (!ownerGroups.length) {
    const option = document.createElement("option");

    option.value = "";
    option.textContent = "초대 가능한 그룹 없음";
    memberInviteGroupSelect.appendChild(option);
    return;
  }

  for (const group of ownerGroups) {
    const option = document.createElement("option");

    option.value = group.id;
    option.textContent = group.name;
    memberInviteGroupSelect.appendChild(option);
  }
}

function renderMemberMessages(isLoggedIn, isBusy) {
  if (!memberMessageList) {
    return;
  }

  memberMessageList.replaceChildren();

  if (!isLoggedIn) {
    memberMessageList.appendChild(createMemberEmptyItem("로그인 후 메시지를 확인할 수 있습니다."));
    return;
  }

  if (!memberMessages.length) {
    memberMessageList.appendChild(createMemberEmptyItem("새 초대가 없습니다."));
    return;
  }

  for (const message of memberMessages) {
    const item = document.createElement("li");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const body = document.createElement("span");
    const actions = document.createElement("div");
    const groupButton = document.createElement("button");
    const readButton = document.createElement("button");
    const acceptButton = document.createElement("button");
    const rejectButton = document.createElement("button");
    const inviter = message.inviterName || message.inviterEmail;
    const isInvite = message.type === "invite";
    const typeLabel = isInvite ? "초대" : "공지";
    const statusLabel = {
      pending: "대기",
      accepted: "수락됨",
      rejected: "거절됨",
      notice: "공지",
    }[message.status] || "알림";

    item.className = "member-list-item";
    item.classList.toggle("is-unread", !message.isRead);
    main.className = "member-list-main";
    actions.className = "member-list-actions";
    title.textContent = message.title || (isInvite ? `${message.groupName} 초대` : "그룹 알림");
    meta.textContent = [
      typeLabel,
      message.groupName,
      isInvite && inviter ? `보낸 사람 ${inviter}` : "",
      statusLabel,
      formatMemberDate(message.createdAt),
    ].filter(Boolean).join(" · ");
    body.textContent = message.body || "";
    body.hidden = !message.body;
    groupButton.className = "ghost-button member-small-button";
    groupButton.type = "button";
    groupButton.textContent = "그룹";
    groupButton.disabled = isBusy || !message.groupId;
    groupButton.dataset.memberMessageGroup = message.groupId;
    readButton.className = "ghost-button member-small-button";
    readButton.type = "button";
    readButton.textContent = message.isRead ? "읽음" : "읽음 처리";
    readButton.disabled = isBusy || message.isRead;
    readButton.dataset.memberMessageRead = message.id;
    readButton.dataset.memberMessageType = message.type;
    acceptButton.className = "primary-button member-small-button";
    acceptButton.type = "button";
    acceptButton.textContent = "수락";
    acceptButton.disabled = isBusy || message.status !== "pending";
    acceptButton.dataset.memberInviteAccept = message.id;
    rejectButton.className = "ghost-button member-small-button";
    rejectButton.type = "button";
    rejectButton.textContent = "거절";
    rejectButton.disabled = isBusy || message.status !== "pending";
    rejectButton.dataset.memberInviteReject = message.id;

    main.append(title, meta, body);
    actions.append(groupButton, readButton);
    if (isInvite) {
      actions.append(acceptButton, rejectButton);
    }
    item.append(main, actions);
    memberMessageList.appendChild(item);
  }
}

function renderMemberGroupDetail(isLoggedIn, isBusy) {
  if (!memberGroupDetail) {
    return;
  }

  const hasGroup = isLoggedIn && memberGroupDetailData?.id;
  const isOwner = memberGroupDetailData?.role === "owner";

  memberGroupDetail.classList.toggle("is-empty", !hasGroup);

  if (memberGroupDetailTitle) {
    memberGroupDetailTitle.textContent = hasGroup ? memberGroupDetailData.name : "그룹 상세";
  }
  if (memberGroupDetailRole) {
    memberGroupDetailRole.textContent = hasGroup ? memberGroupDetailData.role : "member";
    memberGroupDetailRole.hidden = !hasGroup;
  }
  if (memberGroupDetailStatus) {
    memberGroupDetailStatus.textContent = !isLoggedIn
      ? "로그인 후 그룹 상세를 확인할 수 있습니다."
      : memberGroupDetailInFlight
        ? "그룹 상세를 불러오는 중입니다."
        : hasGroup
          ? [
            memberGroupDetailData.description,
            memberGroupDetailData.memberCount ? `멤버 ${memberGroupDetailData.memberCount}명` : "",
          ].filter(Boolean).join(" · ") || "그룹 큐시트와 공지를 관리합니다."
          : "그룹을 선택하면 상세 정보를 확인합니다.";
  }

  setFormDisabled(memberGroupCueForm, !hasGroup || isBusy || !isOwner);
  setFormDisabled(memberGroupNoticeForm, !hasGroup || isBusy || !isOwner);
  setFormDisabled(memberPerformanceForm, !hasGroup || isBusy || !isOwner);
  setFormDisabled(memberPerformanceCueForm, !hasGroup || isBusy || !isOwner || !memberGroupPerformances.length || !memberGroupCues.length);
  renderMemberGroupMembers(hasGroup);
  renderMemberGroupCues(hasGroup, isBusy, isOwner);
  renderMemberGroupMessages(hasGroup);
  renderMemberPerformanceCueSelects(hasGroup);
  renderMemberPerformances(hasGroup);
}

function renderMemberGroupMembers(hasGroup) {
  if (!memberGroupMemberList) {
    return;
  }

  memberGroupMemberList.replaceChildren();

  if (!hasGroup) {
    memberGroupMemberList.appendChild(createMemberEmptyItem("선택된 그룹이 없습니다."));
    return;
  }

  if (!memberGroupMembers.length) {
    memberGroupMemberList.appendChild(createMemberEmptyItem("멤버가 없습니다."));
    return;
  }

  for (const member of memberGroupMembers) {
    const item = document.createElement("li");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const role = document.createElement("span");

    item.className = "member-list-item";
    main.className = "member-list-main";
    title.textContent = member.name || member.email || "이름 없는 회원";
    meta.textContent = [member.position, member.region, member.genre].filter(Boolean).join(" · ") || member.email;
    role.className = "member-pill";
    role.textContent = member.role;

    main.append(title, meta);
    item.append(main, role);
    memberGroupMemberList.appendChild(item);
  }
}

function renderMemberGroupCues(hasGroup, isBusy, isOwner) {
  if (!memberGroupCueList) {
    return;
  }

  memberGroupCueList.replaceChildren();

  if (!hasGroup) {
    memberGroupCueList.appendChild(createMemberEmptyItem("선택된 그룹이 없습니다."));
    return;
  }

  if (!memberGroupCues.length) {
    memberGroupCueList.appendChild(createMemberEmptyItem("저장된 그룹 큐시트가 없습니다."));
    return;
  }

  for (const cue of memberGroupCues) {
    const item = document.createElement("li");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const actions = document.createElement("div");
    const loadButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    item.className = "member-list-item";
    main.className = "member-list-main";
    actions.className = "member-list-actions";
    title.textContent = cue.title;
    meta.textContent = [
      `${cue.itemCount}개 항목`,
      formatDuration(cue.durationSeconds),
      formatMemberDate(cue.updatedAt),
    ].filter(Boolean).join(" · ");
    loadButton.className = "primary-button member-small-button";
    loadButton.type = "button";
    loadButton.textContent = "불러오기";
    loadButton.disabled = isBusy;
    loadButton.dataset.memberGroupCueLoad = cue.id;
    deleteButton.className = "ghost-button member-small-button";
    deleteButton.type = "button";
    deleteButton.textContent = "삭제";
    deleteButton.disabled = isBusy || !isOwner;
    deleteButton.dataset.memberGroupCueDelete = cue.id;

    main.append(title, meta);
    actions.append(loadButton, deleteButton);
    item.append(main, actions);
    memberGroupCueList.appendChild(item);
  }
}

function renderMemberGroupMessages(hasGroup) {
  if (!memberGroupNoticeList) {
    return;
  }

  memberGroupNoticeList.replaceChildren();

  if (!hasGroup) {
    memberGroupNoticeList.appendChild(createMemberEmptyItem("선택된 그룹이 없습니다."));
    return;
  }

  if (!memberGroupMessages.length) {
    memberGroupNoticeList.appendChild(createMemberEmptyItem("그룹 공지가 없습니다."));
    return;
  }

  for (const message of memberGroupMessages) {
    const item = document.createElement("li");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const body = document.createElement("span");

    item.className = "member-list-item";
    item.classList.toggle("is-unread", !message.isRead);
    main.className = "member-list-main";
    title.textContent = message.title;
    meta.textContent = [
      message.isRead ? "읽음" : "안읽음",
      formatMemberDate(message.createdAt),
    ].filter(Boolean).join(" · ");
    body.textContent = message.body || "";
    body.hidden = !message.body;

    main.append(title, meta, body);
    item.append(main);
    memberGroupNoticeList.appendChild(item);
  }
}

function renderMemberPerformances(hasGroup) {
  if (!memberPerformanceList) {
    return;
  }

  memberPerformanceList.replaceChildren();

  if (!hasGroup) {
    memberPerformanceList.appendChild(createMemberEmptyItem("선택된 그룹이 없습니다."));
    return;
  }

  if (!memberGroupPerformances.length) {
    memberPerformanceList.appendChild(createMemberEmptyItem("등록된 공연이 없습니다."));
    return;
  }

  for (const performance of memberGroupPerformances) {
    const item = document.createElement("li");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    const memo = document.createElement("span");
    const cueLinks = document.createElement("span");
    const linkedCues = memberPerformanceCueLinks[performance.id] || [];

    item.className = "member-list-item";
    main.className = "member-list-main";
    title.textContent = performance.title;
    meta.textContent = [
      performance.performanceDate,
      performance.location,
    ].filter(Boolean).join(" · ") || "날짜와 장소 미정";
    memo.textContent = performance.memo || "";
    memo.hidden = !performance.memo;
    cueLinks.textContent = linkedCues.length
      ? `연결 큐시트: ${linkedCues.map((cue) => cue.title || `#${cue.groupCueId}`).join(", ")}`
      : "연결된 큐시트 없음";

    main.append(title, meta, memo, cueLinks);
    item.append(main);
    memberPerformanceList.appendChild(item);
  }
}

function renderMemberPerformanceCueSelects(hasGroup) {
  if (!memberPerformanceSelect || !memberPerformanceCueSelect) {
    return;
  }

  memberPerformanceSelect.replaceChildren();
  memberPerformanceCueSelect.replaceChildren();

  if (!hasGroup || !memberGroupPerformances.length) {
    const option = document.createElement("option");

    option.value = "";
    option.textContent = "공연 없음";
    memberPerformanceSelect.appendChild(option);
  } else {
    for (const performance of memberGroupPerformances) {
      const option = document.createElement("option");

      option.value = performance.id;
      option.textContent = performance.title;
      memberPerformanceSelect.appendChild(option);
    }
  }

  if (!hasGroup || !memberGroupCues.length) {
    const option = document.createElement("option");

    option.value = "";
    option.textContent = "그룹 큐시트 없음";
    memberPerformanceCueSelect.appendChild(option);
    return;
  }

  for (const cue of memberGroupCues) {
    const option = document.createElement("option");

    option.value = cue.id;
    option.textContent = cue.title;
    memberPerformanceCueSelect.appendChild(option);
  }
}

function setFormDisabled(form, disabled) {
  if (!form) {
    return;
  }

  for (const control of form.querySelectorAll("input, textarea, select, button")) {
    control.disabled = disabled;
  }
}

function createMemberEmptyItem(text) {
  const item = document.createElement("li");

  item.className = "member-list-empty";
  item.textContent = text;
  return item;
}

function formatMemberDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function updateAuthUi() {
  window.CueSheetAuthNav?.setAuthenticated(authSession.authenticated);

  const googleConfigured = authSession.databaseConfigured && authSession.googleLoginConfigured;

  if (googleSignInButton) {
    googleSignInButton.hidden = authSession.authenticated || !googleConfigured;
  }
  if (emailAuthForm) {
    emailAuthForm.hidden = authSession.authenticated;
  }
  if (emailAuthInput) {
    emailAuthInput.disabled = emailAuthInFlight || authSession.authenticated;
  }
  if (emailPasswordInput) {
    emailPasswordInput.disabled = emailAuthInFlight || authSession.authenticated;
  }
  if (emailLoginButton) {
    emailLoginButton.disabled = emailAuthInFlight || authSession.authenticated;
  }
  if (authAccount) {
    authAccount.hidden = !authSession.authenticated;
  }
  if (authEmailLabel) {
    authEmailLabel.hidden = !authSession.authenticated;
  }
  if (logoutButton) {
    logoutButton.hidden = !authSession.authenticated;
    logoutButton.disabled = authInFlight || emailAuthInFlight;
  }
  if (memberLoginLink) {
    memberLoginLink.hidden = authSession.authenticated;
  }

  if (authSession.authenticated) {
    const maskedEmail = maskEmail(authSession.email);

    if (authTitle) {
      authTitle.textContent = "로그인됨";
    }
    if (authEmailLabel) {
      authEmailLabel.textContent = maskedEmail;
    }
    if (authStatus) {
      authStatus.textContent = authNotice || `${maskedEmail} 계정으로 개인 큐시트를 저장합니다.`;
    }
    return;
  }

  if (authEmailLabel) {
    authEmailLabel.textContent = "";
  }
  if (authTitle) {
    authTitle.textContent = "이메일 로그인";
  }

  if (!authSession.databaseConfigured) {
    if (authStatus) {
      authStatus.textContent = authSession.message || "DB 연결이 아직 설정되지 않았습니다.";
    }
    return;
  }

  if (authStatus) {
    authStatus.textContent = authNotice || "가입한 이메일과 비밀번호로 로그인합니다.";
  }
  renderGoogleSignInButton();
}

function getDragAfterElement(container, pointerY) {
  if (!container) {
    return null;
  }

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

  if (!cueList) {
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

  if (!item || !cueList?.contains(item) || cues.length < 2) {
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

  if (!state?.item.isConnected || !cueList) {
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
  if (!cueList) {
    updateActionState();
    return;
  }

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

  if (!todoEditor) {
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
