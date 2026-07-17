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
