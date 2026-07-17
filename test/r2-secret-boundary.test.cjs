const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(ROOT, fileName), "utf8");
}

function ignoreEntries(fileName) {
  return new Set(
    read(fileName)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
}

test("Cloudflare credential source is excluded from Git and Vercel uploads", () => {
  const gitignore = ignoreEntries(".gitignore");
  const vercelignore = ignoreEntries(".vercelignore");

  assert.ok(gitignore.has("cloudflare.md"));
  assert.ok(vercelignore.has("cloudflare.md"));
  assert.ok(vercelignore.has(".env*"));
});

test("tests, migrations and internal setup documents are not deployed as static assets", () => {
  const vercelignore = ignoreEntries(".vercelignore");

  assert.ok(vercelignore.has("test"));
  assert.ok(vercelignore.has("migrations"));
  assert.ok(vercelignore.has("*.md"));
});

test("browser assets do not reference server-only R2 credential variables", () => {
  const browserFiles = [
    "workspace.html",
    "mypage.html",
    "signup.html",
    "script.js",
    "profile-image-editor.js",
    "r2-image-upload.js",
  ];
  const credentialPattern = /R2_(?:ACCOUNT_ID|ACCESS_KEY_ID|SECRET_ACCESS_KEY|BUCKET_NAME)/;

  for (const fileName of browserFiles) {
    assert.doesNotMatch(read(fileName), credentialPattern, `${fileName} must not expose R2 credentials`);
  }

  assert.match(read("api/_lib/r2.js"), /process\.env\.R2_SECRET_ACCESS_KEY/);
});
