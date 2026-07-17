const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const EDITOR_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "profile-image-editor.js"),
  "utf8",
);

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, initial = {}) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...initial,
    };

    for (const listener of this.listeners.get(type) || []) {
      listener.call(this, event);
    }

    return event;
  }
}

class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  add(...names) {
    names.forEach((name) => this.names.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.names.delete(name));
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.names.has(name) : Boolean(force);
    if (shouldAdd) this.names.add(name);
    else this.names.delete(name);
    return shouldAdd;
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement extends FakeEventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.disabled = false;
    this.files = [];
    this.textContent = "";
    this.value = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  toggleAttribute(name, force) {
    const shouldAdd = force === undefined ? !this.attributes.has(name) : Boolean(force);
    if (shouldAdd) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return shouldAdd;
  }

  click() {
    this.dispatch("click");
  }
}

function createHarness() {
  const images = [];
  const createdUrls = [];
  const revokedUrls = [];
  let objectUrlSequence = 0;

  class FakeImage {
    constructor() {
      this.naturalWidth = 1024;
      this.naturalHeight = 1024;
      this.onload = null;
      this.onerror = null;
      this.src = "";
      images.push(this);
    }
  }

  class FakeFile {
    constructor(parts, name, options = {}) {
      this.name = name;
      this.type = options.type || "";
      this.lastModified = options.lastModified;
      this.size = parts.reduce((total, part) => total + Number(part?.size || 0), 0);
    }
  }

  const drawCalls = [];
  const context2d = {
    clearRect() {},
    drawImage(...args) {
      drawCalls.push(args);
    },
  };

  const canvas = new FakeElement();
  canvas.getContext = () => context2d;
  canvas.getBoundingClientRect = () => ({ width: 512 });
  canvas.setPointerCapture = () => {};
  canvas.toBlob = (callback) => callback({ size: 128, type: "image/webp" });

  const drop = new FakeElement();
  const file = new FakeElement();
  const zoom = new FakeElement();
  const message = new FakeElement();
  const save = new FakeElement();
  const choose = new FakeElement();
  const closeButtons = [new FakeElement(), new FakeElement()];

  class FakeDialog extends FakeElement {
    constructor() {
      super();
      this.open = false;
      this.selectors = new Map([
        ["canvas", canvas],
        ["[data-drop]", drop],
        ["[data-file]", file],
        ["[data-zoom]", zoom],
        ["[data-message]", message],
        ["[data-save]", save],
        ["[data-choose]", choose],
      ]);
    }

    querySelector(selector) {
      return this.selectors.get(selector) || null;
    }

    querySelectorAll(selector) {
      return selector === "[data-close]" ? closeButtons : [];
    }

    showModal() {
      this.open = true;
    }

    close() {
      this.open = false;
      this.dispatch("close");
    }
  }

  const dialog = new FakeDialog();
  const bodyChildren = [];
  const document = {
    body: {
      append(element) {
        bodyChildren.push(element);
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "dialog");
      return dialog;
    },
  };
  const window = {};
  const urlApi = {
    createObjectURL(selectedFile) {
      const url = `blob:test-${++objectUrlSequence}`;
      createdUrls.push({ file: selectedFile, url });
      return url;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  };

  vm.runInNewContext(EDITOR_SOURCE, {
    Date,
    File: FakeFile,
    Image: FakeImage,
    Object,
    Promise,
    URL: urlApi,
    document,
    window,
  }, { filename: "profile-image-editor.js" });

  return {
    window,
    dialog,
    images,
    createdUrls,
    revokedUrls,
    drawCalls,
    elements: { canvas, drop, file, zoom, message, save, choose, closeButtons },
  };
}

function selectFile(harness, name) {
  harness.elements.file.files = [{ name, type: "image/png", size: 1024 }];
  harness.elements.file.dispatch("change");
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test("a stale Image.onload cannot replace a newer selected image", () => {
  const harness = createHarness();
  harness.window.ProfileImageEditor.open({ onSave() {} });

  selectFile(harness, "first.png");
  selectFile(harness, "second.png");
  assert.equal(harness.images.length, 2);

  const [firstImage, secondImage] = harness.images;
  secondImage.onload();

  assert.equal(harness.drawCalls.length, 1);
  assert.equal(harness.drawCalls[0][0], secondImage);
  assert.equal(harness.elements.save.disabled, false);

  firstImage.onload();

  assert.equal(harness.drawCalls.length, 1, "the stale callback must not redraw the canvas");
  assert.equal(harness.drawCalls[0][0], secondImage);
  assert.deepEqual(harness.revokedUrls, [harness.createdUrls[0].url]);
  assert.equal(harness.revokedUrls.includes(harness.createdUrls[1].url), false);
});

test("closing and reopening invalidates an image decode still in flight", () => {
  const harness = createHarness();
  harness.window.ProfileImageEditor.open({ onSave() {} });
  selectFile(harness, "pending.png");

  const pendingImage = harness.images[0];
  harness.dialog.close();
  harness.window.ProfileImageEditor.open({ onSave() {} });
  pendingImage.onload();

  assert.equal(harness.dialog.open, true);
  assert.equal(harness.drawCalls.length, 0);
  assert.equal(harness.elements.save.disabled, true);
  assert.equal(harness.elements.drop.classList.contains("has-image"), false);
  assert.deepEqual(harness.revokedUrls, [harness.createdUrls[0].url]);
});

test("upload busy state ignores duplicate save clicks", async () => {
  const harness = createHarness();
  let saveCalls = 0;
  let finishUpload;
  const upload = new Promise((resolve) => {
    finishUpload = resolve;
  });

  harness.window.ProfileImageEditor.open({
    onSave() {
      saveCalls += 1;
      return upload;
    },
  });
  selectFile(harness, "ready.png");
  harness.images[0].onload();

  harness.elements.save.dispatch("click");
  harness.elements.save.dispatch("click");
  await flushMicrotasks();

  assert.equal(saveCalls, 1);
  assert.equal(harness.elements.save.disabled, true);
  assert.equal(harness.elements.save.textContent, "업로드 중...");
  assert.equal(harness.dialog.open, true);

  finishUpload();
  await flushMicrotasks();

  assert.equal(saveCalls, 1);
  assert.equal(harness.dialog.open, false);
});
