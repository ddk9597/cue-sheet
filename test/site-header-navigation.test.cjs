const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const aboutHtml = fs.readFileSync(path.join(ROOT, "about.html"), "utf8");
const scriptSource = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const siteHeaderSource = fs.readFileSync(path.join(ROOT, "site-header.js"), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

test("공통 헤더에는 핵심 페이지와 밴드 구해요 게시판을 표시한다", () => {
  const mount = {
    dataset: { current: "workspace" },
    outerHTML: "",
  };

  vm.runInNewContext(siteHeaderSource, {
    document: {
      querySelector() {
        return mount;
      },
    },
  });

  assert.doesNotMatch(mount.outerHTML, />목록 편집<|>관객용 목록<|>마이페이지</);
  assert.match(mount.outerHTML, />홈</);
  assert.match(mount.outerHTML, />소개</);
  assert.match(mount.outerHTML, /href="\.\/recruit\.html"/);
  assert.match(mount.outerHTML, />밴드 구해요</);
  assert.match(mount.outerHTML, />내 작업 공간</);
});

test("독립 목록 편집 페이지 대신 작업 공간 편집 모달을 사용한다", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "cues.html")), false);
  assert.doesNotMatch(siteHeaderSource, /\.\/cues\.html/);
  assert.doesNotMatch(aboutHtml, /\.\/cues\.html/);
  assert.doesNotMatch(scriptSource, /\.\/cues\.html/);
  assert.match(aboutHtml, /href="\.\/workspace\.html#cue-editor"/);
  assert.match(scriptSource, /window\.location\.href = "\.\/workspace\.html#cue-editor"/);
  assert.match(scriptSource, /function openWorkspaceCueEditorFromUrl\(\)/);

  const legacyCueRedirects = vercelConfig.redirects.filter((redirect) => (
    redirect.source === "/cues" || redirect.source === "/cues.html"
  ));

  assert.deepEqual(
    legacyCueRedirects.map(({ source, destination }) => ({ source, destination })),
    [
      { source: "/cues.html", destination: "/workspace.html?tool=cue" },
      { source: "/cues", destination: "/workspace.html?tool=cue" },
    ],
  );
});
