(function () {
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const OUTPUT_SIZE = 512;
  const state = { image: null, url: "", scale: 1, minScale: 1, x: 0, y: 0, dragging: false };
  let onSave = null;

  const dialog = document.createElement("dialog");
  dialog.className = "profile-image-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="profile-image-card">
      <div class="profile-image-header"><div><small>Profile image</small><strong>프로필 사진 편집</strong></div><button type="button" data-close aria-label="닫기">×</button></div>
      <div class="profile-image-drop" data-drop tabindex="0" role="button" aria-label="이미지를 드래그하거나 파일 선택">
        <canvas width="512" height="512" aria-label="프로필 이미지 자르기 미리보기"></canvas>
        <div class="profile-image-empty"><strong>이미지를 여기에 놓아주세요</strong><span>또는 클릭하여 파일 선택</span><small>JPG, PNG, WebP · 최대 10MB</small></div>
      </div>
      <input data-file type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <label class="profile-image-zoom"><span>축소</span><input data-zoom type="range" min="1" max="3" step="0.01" value="1" disabled><span>확대</span></label>
      <p class="profile-image-message" data-message aria-live="polite">이미지를 움직여 표시할 영역을 정할 수 있습니다.</p>
      <div class="profile-image-actions"><button class="ghost-button" data-choose type="button">다른 이미지 선택</button><span></span><button class="ghost-button" data-close type="button">취소</button><button class="primary-button" data-save type="button" disabled>자르고 저장</button></div>
    </form>`;
  document.body.append(dialog);

  const canvas = dialog.querySelector("canvas");
  const context = canvas.getContext("2d");
  const drop = dialog.querySelector("[data-drop]");
  const fileInput = dialog.querySelector("[data-file]");
  const zoom = dialog.querySelector("[data-zoom]");
  const message = dialog.querySelector("[data-message]");
  const saveButton = dialog.querySelector("[data-save]");
  let pointer = { x: 0, y: 0 };

  function reset() {
    if (state.url) URL.revokeObjectURL(state.url);
    Object.assign(state, { image: null, url: "", scale: 1, minScale: 1, x: 0, y: 0, dragging: false });
    zoom.value = "1";
    zoom.disabled = true;
    saveButton.disabled = true;
    drop.classList.remove("has-image", "is-dragging");
    context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    setMessage("이미지를 움직여 표시할 영역을 정할 수 있습니다.");
  }

  function setMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("is-error", error);
  }

  function loadFile(file) {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("JPG, PNG 또는 WebP 이미지를 선택해 주세요.", true);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMessage("10MB 이하의 이미지를 선택해 주세요.", true);
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (state.url) URL.revokeObjectURL(state.url);
      state.image = image;
      state.url = url;
      state.minScale = Math.max(OUTPUT_SIZE / image.naturalWidth, OUTPUT_SIZE / image.naturalHeight);
      state.scale = state.minScale;
      state.x = (OUTPUT_SIZE - image.naturalWidth * state.scale) / 2;
      state.y = (OUTPUT_SIZE - image.naturalHeight * state.scale) / 2;
      zoom.value = "1";
      zoom.disabled = false;
      saveButton.disabled = false;
      drop.classList.add("has-image");
      setMessage("이미지를 드래그하거나 슬라이더로 크기를 조절하세요.");
      draw();
    };
    image.onerror = () => { URL.revokeObjectURL(url); setMessage("이미지를 읽을 수 없습니다.", true); };
    image.src = url;
  }

  function clamp() {
    if (!state.image) return;
    const width = state.image.naturalWidth * state.scale;
    const height = state.image.naturalHeight * state.scale;
    state.x = Math.min(0, Math.max(OUTPUT_SIZE - width, state.x));
    state.y = Math.min(0, Math.max(OUTPUT_SIZE - height, state.y));
  }

  function draw() {
    context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    if (!state.image) return;
    clamp();
    context.drawImage(state.image, state.x, state.y, state.image.naturalWidth * state.scale, state.image.naturalHeight * state.scale);
  }

  function setZoom(value) {
    if (!state.image) return;
    const centerX = (OUTPUT_SIZE / 2 - state.x) / state.scale;
    const centerY = (OUTPUT_SIZE / 2 - state.y) / state.scale;
    state.scale = state.minScale * Number(value);
    state.x = OUTPUT_SIZE / 2 - centerX * state.scale;
    state.y = OUTPUT_SIZE / 2 - centerY * state.scale;
    draw();
  }

  drop.addEventListener("click", () => { if (!state.image) fileInput.click(); });
  drop.addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && !state.image) fileInput.click(); });
  dialog.querySelector("[data-choose]").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => { loadFile(fileInput.files[0]); fileInput.value = ""; });
  for (const type of ["dragenter", "dragover"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.add("is-dragging"); });
  for (const type of ["dragleave", "drop"]) drop.addEventListener(type, (event) => { event.preventDefault(); drop.classList.remove("is-dragging"); });
  drop.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));
  zoom.addEventListener("input", () => setZoom(zoom.value));
  canvas.addEventListener("pointerdown", (event) => { if (!state.image) return; state.dragging = true; pointer = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", (event) => { if (!state.dragging) return; const ratio = OUTPUT_SIZE / canvas.getBoundingClientRect().width; state.x += (event.clientX - pointer.x) * ratio; state.y += (event.clientY - pointer.y) * ratio; pointer = { x: event.clientX, y: event.clientY }; draw(); });
  canvas.addEventListener("pointerup", () => { state.dragging = false; });
  dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", reset);
  saveButton.addEventListener("click", async () => {
    if (!state.image || !onSave) return;
    saveButton.disabled = true;
    setMessage("프로필 사진을 저장하는 중입니다.");
    try {
      const dataUrl = canvas.toDataURL("image/webp", 0.86);
      await onSave(dataUrl);
      dialog.close();
    } catch (error) {
      setMessage(error.message || "프로필 사진을 저장하지 못했습니다.", true);
      saveButton.disabled = false;
    }
  });

  window.ProfileImageEditor = {
    open(options) {
      reset();
      onSave = options?.onSave;
      dialog.showModal();
    },
  };
})();
