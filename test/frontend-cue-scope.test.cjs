const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const SCRIPT_PATH = path.resolve(__dirname, "../script.js");
const ANONYMOUS_STORAGE_KEY = "cue-sheet-anonymous-draft-v2";
const LEGACY_ANONYMOUS_STORAGE_KEY = "cue-sheet-anonymous-draft";

function cue(title, id = title.toLowerCase().replace(/\s+/g, "-")) {
  return {
    id,
    type: "song",
    title,
    bpm: "120",
    seconds: 180,
    acousticTuning: "standard",
    electricTuning: "standard",
    bassTuning: "standard",
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

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createClassList() {
  const values = new Set();

  return {
    add(...tokens) {
      tokens.forEach((token) => values.add(token));
    },
    contains(token) {
      return values.has(token);
    },
    remove(...tokens) {
      tokens.forEach((token) => values.delete(token));
    },
    toggle(token, force) {
      const enabled = force === undefined ? !values.has(token) : Boolean(force);

      if (enabled) {
        values.add(token);
      } else {
        values.delete(token);
      }

      return enabled;
    },
  };
}

function createElementStub() {
  const element = {
    children: [],
    classList: createClassList(),
    content: {
      cloneNode() {
        const fragment = createElementStub();

        fragment.querySelector = () => createElementStub();
        return fragment;
      },
    },
    dataset: {},
    hidden: false,
    style: {},
    value: "",
    addEventListener() {},
    append(...children) {
      this.children.push(...children);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    cloneNode() {
      return createElementStub();
    },
    closest() {
      return null;
    },
    contains() {
      return false;
    },
    focus() {},
    getAttribute() {
      return null;
    },
    getBoundingClientRect() {
      return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 };
    },
    insertBefore(child) {
      this.children.push(child);
      return child;
    },
    matches() {
      return false;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    remove() {},
    removeAttribute() {},
    replaceChildren(...children) {
      this.children = children;
    },
    reset() {},
    setAttribute() {},
  };

  return element;
}

function createStorage(initialEntries = {}) {
  const values = new Map(Object.entries(initialEntries));
  const calls = {
    get: [],
    remove: [],
    set: [],
  };

  return {
    calls,
    clearCalls() {
      calls.get.length = 0;
      calls.remove.length = 0;
      calls.set.length = 0;
    },
    getItem(key) {
      calls.get.push(String(key));
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    removeItem(key) {
      calls.remove.push(String(key));
      values.delete(String(key));
    },
    setItem(key, value) {
      calls.set.push([String(key), String(value)]);
      values.set(String(key), String(value));
    },
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}

function createHarness({ localStorageEntries = {} } = {}) {
  const localStorage = createStorage(localStorageEntries);
  const sessionStorage = createStorage();
  const documentBody = createElementStub();
  const document = {
    body: documentBody,
    addEventListener() {},
    createElement() {
      return createElementStub();
    },
    createRange() {
      return {
        collapse() {},
        selectNodeContents() {},
        setStartAfter() {},
      };
    },
    execCommand() {
      return false;
    },
    querySelector() {
      return createElementStub();
    },
    querySelectorAll() {
      return [];
    },
  };
  let fetchImplementation = async () => {
    throw new Error("Unexpected fetch call");
  };
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
  sandbox.localStorage = localStorage;
  sandbox.sessionStorage = sessionStorage;
  sandbox.addEventListener = () => {};
  sandbox.alert = () => {};
  sandbox.confirm = () => true;
  sandbox.interact = () => ({ draggable() {} });
  sandbox.prompt = () => null;
  sandbox.requestAnimationFrame = (callback) => callback();
  sandbox.getSelection = () => null;
  sandbox.location = { href: "http://localhost/cues.html" };
  sandbox.matchMedia = () => ({ matches: false });
  sandbox.scrollX = 0;
  sandbox.scrollY = 0;

  const context = vm.createContext(sandbox);
  const originalSource = fs.readFileSync(SCRIPT_PATH, "utf8");
  const bootstrapCall = "\nbootstrap();\n";

  assert.equal(
    originalSource.split(bootstrapCall).length - 1,
    1,
    "test loader must remove only script.js's automatic bootstrap call",
  );

  const source = originalSource.replace(bootstrapCall, "\n") + `
    globalThis.__frontendCueScopeTest = {
      normalizeAuthSession,
      getCueStorageIdentity,
      remoteCueScopeMatches,
      initializeStorage,
      loadRemoteCues,
      persistRemoteCues,
      persistCurrentCues,
      verifyCueSaveSession,
      loadMemberGroupCue,
      refreshAuthSessionOnResume,
      lockCueStorageForUnknownSession,
      setAuthSession,
      setAuthCoordinationReady(value) {
        authCoordinationReady = Boolean(value);
      },
      setSelectedMemberGroupId(value) {
        selectedMemberGroupId = value;
      },
      setStorageMode(value) {
        storageMode = value;
      },
      setSaveInFlight(value) {
        saveInFlight = Boolean(value);
      },
      snapshot() {
        return JSON.stringify({
          authSession,
          cues,
          savedCues,
          storageMode,
          databaseConfigured,
          databaseSeedRequired,
          storageWarningMessage,
          cueStorageLoadVersion,
          cueStorageDisplayLocked,
          cueEditorHidden: Boolean(cueEditorPanel?.hidden),
          cueListHidden: Boolean(cueListPanel?.hidden),
          storageIdentity: getCueStorageIdentity(),
        });
      },
    };
  `;

  vm.runInContext(source, context, { filename: SCRIPT_PATH });

  return {
    api: context.__frontendCueScopeTest,
    localStorage,
    sessionStorage,
    setFetch(implementation) {
      fetchImplementation = implementation;
    },
    snapshot() {
      return JSON.parse(context.__frontendCueScopeTest.snapshot());
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

  assert.fail("Timed out waiting for asynchronous frontend state");
}

function userSession(userId, overrides = {}) {
  return {
    resolved: true,
    authenticated: true,
    userId,
    email: `user-${userId}@example.com`,
    databaseConfigured: true,
    ...overrides,
  };
}

test("auth userId를 문자열 identity로 정규화하고 불완전한 인증은 격리한다", () => {
  const { api } = createHarness();
  const authenticated = api.normalizeAuthSession({
    resolved: true,
    authenticated: true,
    userId: 101,
    email: "  USER@EXAMPLE.COM ",
  });

  assert.equal(authenticated.resolved, true);
  assert.equal(authenticated.userId, "101");
  assert.equal(authenticated.email, "user@example.com");
  assert.equal(api.getCueStorageIdentity(authenticated), "user:101");

  const anonymous = api.normalizeAuthSession({
    resolved: true,
    authenticated: false,
    userId: 202,
  });

  assert.equal(anonymous.userId, "");
  assert.equal(api.getCueStorageIdentity(anonymous), "anonymous");

  const missingUserId = api.normalizeAuthSession({
    resolved: true,
    authenticated: true,
    userId: "  ",
  });

  assert.equal(missingUserId.resolved, false);
  assert.equal(missingUserId.authenticated, false);
  assert.equal(api.getCueStorageIdentity(missingUserId), "");
});

test("A identity는 B 또는 anonymous 범위의 load 응답을 표시하지 않는다", async () => {
  const anonymousDraft = cue("익명 브라우저 초안", "anonymous-draft");
  const harness = createHarness({
    localStorageEntries: {
      [ANONYMOUS_STORAGE_KEY]: JSON.stringify([anonymousDraft]),
      [LEGACY_ANONYMOUS_STORAGE_KEY]: JSON.stringify([anonymousDraft]),
    },
  });
  const { api, localStorage } = harness;

  api.setAuthSession(userSession("101"));
  assert.equal(
    api.remoteCueScopeMatches(
      { authenticated: true, userScoped: true, userId: "202" },
      "user:101",
    ),
    false,
  );
  assert.equal(
    api.remoteCueScopeMatches(
      { authenticated: false, userScoped: false, userId: "" },
      "user:101",
    ),
    false,
  );

  const responses = [
    {
      items: [cue("B 비공개 큐", "b-private")],
      authenticated: true,
      userScoped: true,
      userId: "202",
    },
    {
      items: [cue("공용 익명 큐", "legacy-public")],
      authenticated: false,
      userScoped: false,
      userId: null,
    },
  ];

  harness.setFetch(async () => jsonResponse(responses.shift()));

  await api.initializeStorage();
  let state = harness.snapshot();

  assert.deepEqual(state.cues, []);
  assert.equal(state.storageMode, "local");
  assert.match(state.storageWarningMessage, /범위가 일치하지 않아/);

  await api.initializeStorage();
  state = harness.snapshot();

  assert.deepEqual(state.cues, []);
  assert.equal(state.storageMode, "local");
  assert.equal(
    localStorage.calls.get.includes(ANONYMOUS_STORAGE_KEY),
    false,
    "personal storage must not fall back to an anonymous draft after a scope mismatch",
  );
});

test("로그인 사용자는 anonymous localStorage를 읽거나 개인 DB에 seed하지 않는다", async () => {
  const harness = createHarness({
    localStorageEntries: {
      [ANONYMOUS_STORAGE_KEY]: JSON.stringify([cue("익명 초안", "anonymous-only")]),
      [LEGACY_ANONYMOUS_STORAGE_KEY]: JSON.stringify([cue("이전 익명 초안", "legacy-anonymous")]),
    },
  });
  const { api, localStorage } = harness;

  api.setAuthSession(userSession("101"));
  harness.setFetch(async () => jsonResponse({
    items: [],
    authenticated: true,
    userScoped: true,
    userId: "101",
  }));

  localStorage.clearCalls();
  await api.initializeStorage();

  const state = harness.snapshot();

  assert.deepEqual(state.cues, []);
  assert.deepEqual(state.savedCues, []);
  assert.equal(state.storageMode, "database");
  assert.equal(state.databaseSeedRequired, false);
  assert.deepEqual(localStorage.calls.get, []);
  assert.deepEqual(localStorage.calls.set, []);
  assert.equal(
    JSON.parse(localStorage.snapshot()[ANONYMOUS_STORAGE_KEY])[0].title,
    "익명 초안",
    "initializing personal storage must leave the anonymous draft untouched",
  );
  assert.equal(
    JSON.parse(localStorage.snapshot()[LEGACY_ANONYMOUS_STORAGE_KEY])[0].title,
    "이전 익명 초안",
    "initializing personal storage must not migrate a legacy anonymous draft",
  );
});

test("A의 늦은 load 응답은 B 초기화가 끝난 뒤 화면 상태를 덮지 않는다", async () => {
  const harness = createHarness();
  const { api } = harness;
  const requests = [];

  harness.setFetch(() => {
    const deferred = createDeferred();

    requests.push(deferred);
    return deferred.promise;
  });

  api.setAuthSession(userSession("101"));
  const loadA = api.initializeStorage();

  assert.equal(requests.length, 1);

  api.setAuthSession(userSession("202"));
  const loadB = api.initializeStorage();

  assert.equal(requests.length, 2);

  requests[1].resolve(jsonResponse({
    items: [cue("B 최신 큐", "b-current")],
    authenticated: true,
    userScoped: true,
    userId: "202",
  }));
  await loadB;

  assert.equal(harness.snapshot().cues[0].title, "B 최신 큐");

  requests[0].resolve(jsonResponse({
    items: [cue("A 늦은 큐", "a-stale")],
    authenticated: true,
    userScoped: true,
    userId: "101",
  }));
  await loadA;

  const state = harness.snapshot();

  assert.equal(state.storageIdentity, "user:202");
  assert.deepEqual(state.cues.map((item) => item.title), ["B 최신 큐"]);
  assert.deepEqual(state.savedCues.map((item) => item.title), ["B 최신 큐"]);
});

test("authenticated PUT은 expectedUserId를 보내고 동일 account scope 응답만 성공시킨다", async () => {
  const harness = createHarness();
  const { api, localStorage } = harness;
  const calls = [];
  const responses = [
    {
      items: [cue("A 저장 큐", "a-save")],
      authenticated: true,
      userScoped: true,
      userId: "101",
    },
    {
      items: [cue("B 응답 큐", "b-response")],
      authenticated: true,
      userScoped: true,
      userId: "202",
    },
    {
      items: [cue("익명 응답 큐", "anonymous-response")],
      authenticated: false,
      userScoped: false,
      userId: null,
    },
  ];

  api.setAuthSession(userSession("101"));
  api.setStorageMode("database");
  harness.setFetch(async (url, options = {}) => {
    calls.push({ url, options });
    return jsonResponse(responses.shift());
  });

  localStorage.clearCalls();
  const saved = await api.persistCurrentCues(
    [cue("A 저장 큐", "a-save")],
    "",
    "user:101",
  );

  assert.equal(saved.ok, true);
  assert.equal(calls[0].url, "/api/cues");
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");

  const firstBody = JSON.parse(calls[0].options.body);

  assert.equal(firstBody.expectedUserId, "101");
  assert.equal(firstBody.password, "");
  assert.deepEqual(firstBody.items.map((item) => item.title), ["A 저장 큐"]);
  assert.deepEqual(localStorage.calls.set, []);

  const wrongUser = await api.persistCurrentCues(
    [cue("A 두 번째 저장", "a-second")],
    "",
    "user:101",
  );

  assert.equal(wrongUser.ok, false);
  assert.equal(wrongUser.code, "session_changed");
  assert.equal(JSON.parse(calls[1].options.body).expectedUserId, "101");

  const anonymousResponse = await api.persistCurrentCues(
    [cue("A 세 번째 저장", "a-third")],
    "",
    "user:101",
  );

  assert.equal(anonymousResponse.ok, false);
  assert.equal(anonymousResponse.code, "session_changed");
  assert.equal(JSON.parse(calls[2].options.body).expectedUserId, "101");
});

test("지연된 저장 전 세션 확인은 계정 전환 뒤 이전 인증을 되살리지 않는다", async () => {
  const harness = createHarness();
  const { api } = harness;
  const deferredSession = createDeferred();

  api.setAuthSession(userSession("101"));
  harness.setFetch(() => deferredSession.promise);

  const verification = api.verifyCueSaveSession("user:101");

  api.setAuthSession(userSession("202"));
  deferredSession.resolve(jsonResponse({
    authenticated: true,
    userId: "101",
    email: "a@example.com",
    databaseConfigured: true,
  }));

  const result = await verification;
  const state = harness.snapshot();

  assert.equal(result.ok, false);
  assert.match(result.message, /로그인 상태가 변경/);
  assert.equal(state.storageIdentity, "user:202");
  assert.equal(state.authSession.userId, "202");
});

test("이전 계정의 지연된 그룹 큐 응답은 새 계정 화면과 익명 저장소를 덮지 않는다", async () => {
  const harness = createHarness();
  const { api, localStorage } = harness;
  const deferredGroupCue = createDeferred();

  api.setAuthSession(userSession("101"));
  api.setSelectedMemberGroupId("group-a");
  harness.setFetch(() => deferredGroupCue.promise);

  const loadGroupCue = api.loadMemberGroupCue("group-cue-a");

  api.setAuthSession(userSession("202"));
  deferredGroupCue.resolve(jsonResponse({
    cue: {
      id: "group-cue-a",
      items: [cue("A 지연 그룹 큐", "a-stale-group-cue")],
    },
  }));
  await loadGroupCue;

  const state = harness.snapshot();

  assert.equal(state.storageIdentity, "user:202");
  assert.deepEqual(state.cues, []);
  assert.deepEqual(localStorage.calls.set, []);
});

test("탭 복귀 세션 확인은 A 화면을 현재 B 계정의 개인 큐로 교체한다", async () => {
  const harness = createHarness();
  const { api } = harness;

  api.setAuthSession(userSession("101"));
  harness.setFetch(async () => jsonResponse({
    items: [cue("A 개인 큐", "a-personal")],
    authenticated: true,
    userScoped: true,
    userId: "101",
  }));
  await api.initializeStorage();

  assert.deepEqual(harness.snapshot().cues.map((item) => item.title), ["A 개인 큐"]);

  api.setAuthCoordinationReady(true);
  harness.setFetch(async (url) => {
    if (url === "/api/auth/session") {
      return jsonResponse({
        authenticated: true,
        userId: "202",
        email: "b@example.com",
        databaseConfigured: true,
        emailLoginConfigured: true,
      });
    }

    if (url === "/api/cues") {
      return jsonResponse({
        items: [cue("B 개인 큐", "b-personal")],
        authenticated: true,
        userScoped: true,
        userId: "202",
      });
    }

    if (url === "/api/practice") {
      return jsonResponse({ logs: {} });
    }

    if (url === "/api/todos") {
      return jsonResponse({ html: "", authenticated: true, userScoped: true });
    }

    return jsonResponse({});
  });

  await api.refreshAuthSessionOnResume();

  const state = harness.snapshot();

  assert.equal(state.storageIdentity, "user:202");
  assert.equal(state.authSession.userId, "202");
  assert.deepEqual(state.cues.map((item) => item.title), ["B 개인 큐"]);
  assert.deepEqual(state.savedCues.map((item) => item.title), ["B 개인 큐"]);
});

test("저장 중 받은 계정 변경 신호는 유실되지 않고 저장 종료 뒤 재확인된다", async () => {
  const harness = createHarness();
  const { api } = harness;

  api.setAuthSession(userSession("101"));
  api.setAuthCoordinationReady(true);
  api.setSaveInFlight(true);
  harness.setFetch(async (url) => {
    if (url === "/api/auth/session") {
      return jsonResponse({
        authenticated: true,
        userId: "202",
        email: "b@example.com",
        databaseConfigured: true,
      });
    }

    if (url === "/api/cues") {
      return jsonResponse({
        items: [cue("B 대기 후 큐", "b-after-pending")],
        authenticated: true,
        userScoped: true,
        userId: "202",
      });
    }

    if (url === "/api/practice") {
      return jsonResponse({ logs: {} });
    }

    if (url === "/api/todos") {
      return jsonResponse({ html: "", authenticated: true, userScoped: true });
    }

    return jsonResponse({});
  });

  await api.refreshAuthSessionOnResume();
  assert.equal(harness.snapshot().storageIdentity, "user:101");

  api.setSaveInFlight(false);
  await waitFor(() => harness.snapshot().storageIdentity === "user:202");

  assert.deepEqual(
    harness.snapshot().cues.map((item) => item.title),
    ["B 대기 후 큐"],
  );
});

test("세션을 확인할 수 없으면 개인 큐 데이터는 메모리에 보존하되 화면은 잠근다", async () => {
  const harness = createHarness();
  const { api } = harness;

  api.setAuthSession(userSession("101"));
  harness.setFetch(async () => jsonResponse({
    items: [cue("A 잠금 대상 큐", "a-lock-target")],
    authenticated: true,
    userScoped: true,
    userId: "101",
  }));
  await api.initializeStorage();

  api.lockCueStorageForUnknownSession(api.normalizeAuthSession({
    resolved: false,
    authenticated: false,
    message: "세션 확인 실패",
  }));

  const state = harness.snapshot();

  assert.equal(state.storageIdentity, "");
  assert.equal(state.cueStorageDisplayLocked, true);
  assert.equal(state.cueEditorHidden, true);
  assert.equal(state.cueListHidden, true);
  assert.deepEqual(state.cues.map((item) => item.title), ["A 잠금 대상 큐"]);
});
