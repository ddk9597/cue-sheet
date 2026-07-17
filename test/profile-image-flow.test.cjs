const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(ROOT, fileName), "utf8");
}

test("profile pages load the direct R2 uploader before the image editor", () => {
  for (const fileName of ["workspace.html", "mypage.html", "signup.html"]) {
    const source = read(fileName);
    const uploaderIndex = source.indexOf("./r2-image-upload.js");
    const editorIndex = source.indexOf("./profile-image-editor.js");

    assert.notEqual(uploaderIndex, -1, `${fileName} must load the R2 uploader`);
    assert.notEqual(editorIndex, -1, `${fileName} must load the image editor`);
    assert.ok(uploaderIndex < editorIndex, `${fileName} must load the uploader first`);
    assert.doesNotMatch(source, /name=["'](?:pictureUrl|profilePicture)["']/);
  }
});

test("the editor emits a cropped File and enforces the shared image policy", () => {
  const source = read("profile-image-editor.js");

  assert.match(source, /5 \* 1024 \* 1024/);
  assert.match(source, /image\/jpeg/);
  assert.match(source, /image\/png/);
  assert.match(source, /image\/webp/);
  assert.match(source, /image\/avif/);
  assert.match(source, /canvas\.toBlob/);
  assert.match(source, /new File\(/);
  assert.doesNotMatch(source, /canvas\.toDataURL/);
});

test("profile clients no longer send base64 or a full image URL to member APIs", () => {
  const workspaceScript = read("script.js");
  const signupPage = read("signup.html");

  assert.doesNotMatch(workspaceScript, /fetchMemberJson\(["']profile-image["'],\s*\{\s*method:\s*["']POST["']/s);
  assert.doesNotMatch(workspaceScript, /body:\s*\{\s*dataUrl\s*\}/);
  assert.doesNotMatch(signupPage, /\/api\/member\/profile-image/);
  assert.doesNotMatch(signupPage, /pendingProfileImageDataUrl|pictureUrlInput/);
  assert.match(workspaceScript, /uploadImageToR2\(file,\s*["']profile["']/);
  assert.match(signupPage, /uploadImageToR2\(file,\s*["']profile["']/);
});

test("signup locks image selection during submit and only clears the uploaded pending file", () => {
  const source = read("signup.html");

  assert.match(source, /signupProfilePictureButton\.disabled\s*=\s*isBusy/);
  assert.match(source, /if \(pendingProfileImageFile === file\)\s*\{\s*pendingProfileImageFile = null;/s);
});

test("profile image changes preserve unsaved text fields and retain a visible error state", () => {
  const source = read("script.js");
  const uploadBody = source.slice(
    source.indexOf("async function uploadMemberProfileImage"),
    source.indexOf("async function removeMemberProfileImage"),
  );
  const removeBody = source.slice(
    source.indexOf("async function removeMemberProfileImage"),
    source.indexOf("async function createMemberGroup"),
  );

  assert.doesNotMatch(uploadBody, /syncMemberProfileForm\(/);
  assert.doesNotMatch(removeBody, /syncMemberProfileForm\(/);
  assert.match(uploadBody, /renderMemberProfilePreview\(/);
  assert.match(removeBody, /renderMemberProfilePreview\(/);
  assert.match(source, /memberStatus\.classList\.toggle\("is-error", statusIsError\)/);
  assert.match(source, /memberWorkspaceModalStatus\.classList\.toggle\("is-error", statusIsError\)/);
});

test("profile editor remains scrollable and height-aware on short viewports", () => {
  const source = read("style.css");

  assert.match(source, /\.profile-image-card[^}]*max-height:\s*calc\(100dvh - 24px\)/);
  assert.match(source, /\.profile-image-card[^}]*overflow-y:\s*auto/);
  assert.match(source, /\.profile-image-drop[^}]*52dvh/);
  assert.match(source, /@media \(max-height:\s*700px\)/);
});
