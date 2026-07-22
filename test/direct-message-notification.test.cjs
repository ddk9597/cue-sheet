const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const authNavSource = fs.readFileSync(path.join(ROOT, "auth-nav.js"), "utf8");
const memberRoute = fs.readFileSync(path.join(ROOT, "api/_lib/routes/member.js"), "utf8");
const siteHeaderSource = fs.readFileSync(path.join(ROOT, "site-header.js"), "utf8");
const styleSource = fs.readFileSync(path.join(ROOT, "style.css"), "utf8");
const workspaceClient = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
const workspaceHtml = fs.readFileSync(path.join(ROOT, "workspace.html"), "utf8");

test("새 쪽지 알림은 전용 미확인 수와 공통 헤더 UI를 사용한다", () => {
  assert.match(memberRoute, /"messages\/unread-count": \["GET"\]/);
  assert.match(memberRoute, /handleGetUnreadDirectMessageCount/);
  assert.match(memberRoute, /unreadDirectMessageCount:/);
  assert.match(siteHeaderSource, /data-direct-message-link/);
  assert.match(siteHeaderSource, /data-direct-message-count/);
  assert.match(siteHeaderSource, /data-direct-message-toast/);
  assert.match(authNavSource, /MESSAGE_POLL_INTERVAL_MS = 30000/);
  assert.match(authNavSource, /visibilitychange/);
  assert.match(authNavSource, /showDirectMessageToast/);
  assert.match(styleSource, /\.site-message-count/);
  assert.match(styleSource, /\.site-message-toast/);
  assert.ok(
    [...workspaceHtml.matchAll(/data-direct-message-count/g)].length >= 2,
    "remaining workspace message entry points should display the unread direct-message count",
  );
});

test("메시지함은 쪽지 내용 열기와 자동 읽음 처리를 연결한다", () => {
  assert.match(workspaceClient, /cue-sheet:direct-message-count/);
  assert.match(workspaceClient, /async function refreshMemberMessages\(\)/);
  assert.match(workspaceClient, /data-member-direct-message-toggle/);
  assert.match(workspaceClient, /function toggleMemberDirectMessage\(messageId\)/);
  assert.match(workspaceClient, /markMemberMessageRead\(normalizedMessageId, "direct_message"\)/);
  assert.match(workspaceClient, /tool=messages/);
});

test("쪽지 수가 증가하면 배지와 도착 토스트가 갱신된다", async () => {
  let unreadCount = 1;
  const messageLink = createElement({ directMessageLink: "" });
  const badge = createElement({ directMessageCount: "" });
  const toastCopy = createElement();
  const toast = createElement();
  const closeButton = createElement();
  const dispatchedEvents = [];

  toast.hidden = true;
  toast.querySelector = (selector) => (
    selector === "[data-direct-message-toast-copy]" ? toastCopy : null
  );

  const document = {
    visibilityState: "visible",
    querySelectorAll(selector) {
      if (selector === "[data-auth-nav-link]") return [];
      if (selector === "[data-direct-message-link]") return [messageLink];
      if (selector === "[data-direct-message-count]") return [badge];
      return [];
    },
    querySelector(selector) {
      if (selector === "[data-direct-message-toast]") return toast;
      if (selector === "[data-direct-message-toast-close]") return closeButton;
      return null;
    },
    addEventListener() {},
  };
  const sandbox = {
    document,
    fetch(url) {
      if (url === "/api/member/messages/unread-count") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ unreadDirectMessageCount: unreadCount }),
        });
      }

      return new Promise(() => {});
    },
    setInterval() {
      return 1;
    },
    clearInterval() {},
    setTimeout() {
      return 2;
    },
    clearTimeout() {},
    addEventListener() {},
    dispatchEvent(event) {
      dispatchedEvents.push(event);
    },
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
  };

  sandbox.window = sandbox;
  vm.runInNewContext(authNavSource, sandbox);

  sandbox.CueSheetAuthNav.setAuthenticated(true);
  await sandbox.CueSheetAuthNav.refreshMessages({ announce: false });
  assert.equal(messageLink.hidden, false);
  assert.equal(badge.textContent, "1");
  assert.equal(badge.hidden, false);
  assert.equal(toast.hidden, true);

  unreadCount = 3;
  await sandbox.CueSheetAuthNav.refreshMessages();
  assert.equal(badge.textContent, "3");
  assert.equal(toastCopy.textContent, "새 쪽지 2개가 도착했습니다.");
  assert.equal(toast.hidden, false);
  assert.equal(dispatchedEvents.at(-1).detail.count, 3);
});

function createElement(dataset = {}) {
  return {
    dataset,
    hidden: false,
    textContent: "",
    attributes: {},
    addEventListener() {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}
