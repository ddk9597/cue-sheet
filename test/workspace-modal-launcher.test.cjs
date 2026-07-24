const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const WORKSPACE_PATH = path.resolve(__dirname, "../workspace.html");
const SCRIPT_PATH = path.resolve(__dirname, "../script.js");

const workspaceHtml = fs.readFileSync(WORKSPACE_PATH, "utf8");
const scriptSource = fs.readFileSync(SCRIPT_PATH, "utf8");

function getAttribute(markup, name) {
  return markup.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1] || "";
}

function getDialogMarkup(id) {
  const start = workspaceHtml.indexOf(`<dialog id="${id}"`);

  if (start < 0) {
    return "";
  }

  const end = workspaceHtml.indexOf("</dialog>", start);
  return end < 0 ? "" : workspaceHtml.slice(start, end + "</dialog>".length);
}

test("작업 공간 빠른 도구 네 개는 페이지 이동 없이 각각의 dialog를 연다", () => {
  const gridMarkup = workspaceHtml.match(
    /<div class="workspace-tool-grid"[^>]*>([\s\S]*?)<\/div>/,
  )?.[1];

  assert.ok(gridMarkup, "workspace tool grid must exist");
  assert.doesNotMatch(gridMarkup, /<a\b/i);

  const buttons = [...gridMarkup.matchAll(/<button\b[\s\S]*?<\/button>/g)]
    .map((match) => match[0]);
  const targets = buttons.map((button) => getAttribute(button, "data-modal-target"));

  assert.deepEqual(targets, [
    "cueModal",
    "practiceModal",
    "todoModal",
    "audienceModal",
  ]);

  const dialogIds = new Set(
    [...workspaceHtml.matchAll(/<dialog\s+id="([^"]+)"/g)].map((match) => match[1]),
  );

  buttons.forEach((button, index) => {
    assert.equal(getAttribute(button, "aria-haspopup"), "dialog");
    assert.equal(getAttribute(button, "aria-controls"), targets[index]);
    assert.ok(dialogIds.has(targets[index]), `${targets[index]} dialog must exist`);
  });
});

test("목록 편집과 관객용 목록은 workspace DOM 안에서 동작한다", () => {
  const cueModalMarkup = workspaceHtml.match(
    /<dialog id="cueModal"[\s\S]*?<\/dialog>/,
  )?.[0];
  const audienceModalMarkup = workspaceHtml.match(
    /<dialog id="audienceModal"[\s\S]*?<\/dialog>/,
  )?.[0];

  assert.ok(cueModalMarkup, "cue modal must exist");
  assert.match(cueModalMarkup, /id="cueForm"/);
  assert.match(cueModalMarkup, /id="cueList"/);
  assert.match(cueModalMarkup, /id="saveButton"/);
  assert.match(scriptSource, /const hasCueEditor = Boolean\(/);

  assert.ok(audienceModalMarkup, "audience modal must exist");
  assert.doesNotMatch(audienceModalMarkup, /<iframe\b/i);
  assert.match(audienceModalMarkup, /id="workspaceAudienceList"/);
  assert.match(scriptSource, /fetch\(AUDIENCE_CUES_ENDPOINT/);
});

test("회원 관리 카드는 내 작업공간, 그룹, 메시지함 모달을 각각 연다", () => {
  const gridMarkup = workspaceHtml.match(
    /<section class="workspace-management-grid"[^>]*>([\s\S]*?)<\/section>/,
  )?.[1];

  assert.ok(gridMarkup, "workspace management grid must exist");

  const buttons = [...gridMarkup.matchAll(/<button\b[\s\S]*?<\/button>/g)]
    .map((match) => match[0]);
  const targets = buttons.map((button) => getAttribute(button, "data-modal-target"));

  assert.deepEqual(targets, ["workspaceModal", "groupModal", "messagesModal"]);

  buttons.forEach((button, index) => {
    assert.match(button, /\bdata-member-modal-trigger\b/);
    assert.equal(getAttribute(button, "aria-haspopup"), "dialog");
    assert.equal(getAttribute(button, "aria-controls"), targets[index]);
    assert.ok(getDialogMarkup(targets[index]), `${targets[index]} dialog must exist`);
  });
});

test("개인, 그룹, 받은 메시지 요소는 서로 다른 dialog에만 배치된다", () => {
  const personalDialog = getDialogMarkup("workspaceModal");
  const groupDialog = getDialogMarkup("groupModal");
  const messagesDialog = getDialogMarkup("messagesModal");

  assert.match(personalDialog, /id="memberProfileForm"/);
  assert.match(personalDialog, /id="memberMemoForm"/);
  assert.doesNotMatch(personalDialog, /id="memberMessageList"/);

  assert.match(groupDialog, /id="memberGroupList"/);
  assert.match(groupDialog, /id="memberInviteForm"/);
  assert.match(groupDialog, /id="memberGroupDetail"/);
  assert.doesNotMatch(groupDialog, /id="memberMessageList"/);

  assert.match(messagesDialog, /id="memberMessagesModalStatus"/);
  assert.match(messagesDialog, /id="memberMessageList"/);
  assert.doesNotMatch(messagesDialog, /id="memberInviteForm"/);
});

test("메시지의 그룹 버튼은 권한을 확인한 뒤 그룹 모달로 전환한다", () => {
  assert.match(scriptSource, /function openMemberGroupFromMessage\(groupId\)/);
  assert.match(scriptSource, /closeModal\(messagesModal\)/);
  assert.match(scriptSource, /openModalById\(groupModal\.id\)/);
  assert.match(scriptSource, /if \(canOpenGroup\) \{[\s\S]*groupButton\.dataset\.memberMessageGroup = message\.groupId/);
  assert.match(scriptSource, /function focusMemberMessagesFeedback\(\)/);
});
