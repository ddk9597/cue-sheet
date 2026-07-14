const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const LOGIN_SCRIPT_PATH = path.resolve(__dirname, "../login.js");
const AUTH_STORAGE_EVENT_KEY = "cue-sheet-auth-session-event";

function createElement() {
  return {
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    hidden: false,
    value: "",
    addEventListener() {},
    focus() {},
    replaceChildren() {},
  };
}

function jsonResponse(payload, { ok = true, status = ok ? 200 : 500 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

function createHarness() {
  const elements = new Map();
  const windowListeners = new Map();
  const documentListeners = new Map();
  let fetchImplementation = async () => {
    throw new Error("Unexpected fetch call");
  };
  const addListener = (target, type, listener) => {
    const listeners = target.get(type) || [];

    listeners.push(listener);
    target.set(type, listeners);
  };
  const document = {
    visibilityState: "visible",
    addEventListener(type, listener) {
      addListener(documentListeners, type, listener);
    },
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, createElement());
      }

      return elements.get(selector);
    },
  };
  const localValues = new Map();
  const sandbox = {
    console,
    document,
    fetch(...args) {
      return fetchImplementation(...args);
    },
    setTimeout,
    clearTimeout,
  };

  sandbox.window = sandbox;
  sandbox.addEventListener = (type, listener) => {
    addListener(windowListeners, type, listener);
  };
  sandbox.localStorage = {
    getItem(key) {
      return localValues.get(String(key)) ?? null;
    },
    removeItem(key) {
      localValues.delete(String(key));
    },
    setItem(key, value) {
      localValues.set(String(key), String(value));
    },
  };
  sandbox.location = { href: "http://localhost/login.html" };
  sandbox.CueSheetAuthNav = { setAuthenticated() {} };

  const context = vm.createContext(sandbox);
  const originalSource = fs.readFileSync(LOGIN_SCRIPT_PATH, "utf8");
  const initializeCall = "\ninitializeLoginPage();\n";

  assert.equal(
    originalSource.split(initializeCall).length - 1,
    1,
    "test loader must remove only login.js's automatic initialization call",
  );

  const source = originalSource.replace(initializeCall, "\n") + `
    globalThis.__loginCoordinationTest = {
      normalizeAuthSession,
      setAuthSession,
      refreshAuthSessionOnResume,
      setReady(value) {
        authCoordinationReady = Boolean(value);
      },
      setBusy(value) {
        authInFlight = Boolean(value);
      },
      snapshot() {
        return JSON.stringify({
          authSession,
          authGeneration,
          authRefreshPending,
          authRefreshInFlight,
          authNotice,
        });
      },
    };
  `;

  vm.runInContext(source, context, { filename: LOGIN_SCRIPT_PATH });

  return {
    api: context.__loginCoordinationTest,
    dispatchWindow(type, event = {}) {
      for (const listener of windowListeners.get(type) || []) {
        listener(event);
      }
    },
    setFetch(implementation) {
      fetchImplementation = implementation;
    },
    snapshot() {
      return JSON.parse(context.__loginCoordinationTest.snapshot());
    },
  };
}

async function waitFor(predicate, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert.fail("Timed out waiting for login coordination state");
}

function userSession(userId) {
  return {
    resolved: true,
    authenticated: true,
    userId,
    email: `user-${userId}@example.com`,
    databaseConfigured: true,
  };
}

test("로그인 페이지는 다른 탭의 storage 신호를 받고 현재 계정으로 갱신한다", async () => {
  const harness = createHarness();
  const { api } = harness;

  api.setAuthSession(userSession("101"));
  api.setReady(true);
  harness.setFetch(async () => jsonResponse({
    authenticated: true,
    userId: "202",
    email: "user-202@example.com",
    databaseConfigured: true,
  }));

  harness.dispatchWindow("storage", { key: AUTH_STORAGE_EVENT_KEY });
  await waitFor(() => harness.snapshot().authSession.userId === "202");

  const state = harness.snapshot();

  assert.equal(state.authSession.authenticated, true);
  assert.equal(state.authSession.userId, "202");
  assert.match(state.authNotice, /다른 탭에서 변경된 로그인 계정/);
});

test("로그인 페이지의 busy 중 계정 변경 신호도 종료 뒤 재확인된다", async () => {
  const harness = createHarness();
  const { api } = harness;

  api.setAuthSession(userSession("101"));
  api.setReady(true);
  api.setBusy(true);
  harness.setFetch(async () => jsonResponse({
    authenticated: true,
    userId: "202",
    email: "user-202@example.com",
    databaseConfigured: true,
  }));

  harness.dispatchWindow("storage", { key: AUTH_STORAGE_EVENT_KEY });
  assert.equal(harness.snapshot().authSession.userId, "101");

  api.setBusy(false);
  await waitFor(() => harness.snapshot().authSession.userId === "202");

  assert.equal(harness.snapshot().authRefreshPending, false);
});

test("세션 확인 실패 시 로그인 페이지는 이전 계정 라벨을 unknown 상태로 숨긴다", async () => {
  const harness = createHarness();
  const { api } = harness;

  api.setAuthSession(userSession("101"));
  api.setReady(true);
  harness.setFetch(async () => jsonResponse(
    { message: "로그인 상태를 확인하지 못했습니다.", databaseConfigured: true },
    { ok: false, status: 500 },
  ));

  await api.refreshAuthSessionOnResume();

  const state = harness.snapshot();

  assert.equal(state.authSession.resolved, false);
  assert.equal(state.authSession.authenticated, false);
  assert.equal(state.authSession.userId, "");
  assert.match(state.authNotice, /로그인 상태를 확인하지 못했습니다/);
});
