(() => {
  const API_ENDPOINT = "/api/recruit";
  const SESSION_ENDPOINT = "/api/auth/session";
  const PART_CODES = {
    일렉: "EL",
    드럼: "DR",
    기타: "GT",
    베이스: "BS",
    보컬: "VO",
    신디: "SY",
  };
  const state = {
    posts: [],
    intent: "전체",
    instrument: "전체",
    search: "",
    authenticated: null,
  };

  const list = document.querySelector("#recruitPostList");
  const summary = document.querySelector("#recruitResultSummary");
  const searchInput = document.querySelector("#recruitSearchInput");
  const openFormButton = document.querySelector("#openPostFormButton");
  const formDialog = document.querySelector("#postFormDialog");
  const postForm = document.querySelector("#recruitPostForm");
  const formMessage = document.querySelector("#postFormMessage");
  const formAuthNotice = document.querySelector("#postFormAuthNotice");
  const submitButton = document.querySelector("#submitRecruitPostButton");
  const detailDialog = document.querySelector("#postDetailDialog");
  const detail = document.querySelector("#recruitPostDetail");
  const toast = document.querySelector("#recruitToast");
  let toastTimer = null;

  if (!list || !summary) {
    return;
  }

  bindEvents();
  void Promise.all([loadPosts(), checkAuthentication()]);

  function bindEvents() {
    for (const button of document.querySelectorAll("[data-intent-filter]")) {
      button.addEventListener("click", () => {
        state.intent = button.dataset.intentFilter;
        setActiveFilter("[data-intent-filter]", button);
        renderPosts();
      });
    }

    for (const button of document.querySelectorAll("[data-instrument-filter]")) {
      button.addEventListener("click", () => {
        state.instrument = button.dataset.instrumentFilter;
        setActiveFilter("[data-instrument-filter]", button);
        renderPosts();
      });
    }

    searchInput?.addEventListener("input", () => {
      state.search = searchInput.value.trim().toLocaleLowerCase("ko");
      renderPosts();
    });

    openFormButton?.addEventListener("click", () => {
      formMessage.textContent = "";
      formAuthNotice.hidden = state.authenticated !== false;
      formDialog.showModal();
    });

    for (const button of document.querySelectorAll("[data-close-dialog]")) {
      button.addEventListener("click", () => formDialog.close());
    }

    for (const button of document.querySelectorAll("[data-close-detail]")) {
      button.addEventListener("click", () => detailDialog.close());
    }

    formDialog?.addEventListener("click", closeFromBackdrop);
    detailDialog?.addEventListener("click", closeFromBackdrop);
    postForm?.addEventListener("submit", submitPost);
  }

  async function loadPosts() {
    list.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(API_ENDPOINT, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(payload.message || "게시글을 불러오지 못했습니다.");
      }

      state.posts = normalizePosts(payload.posts);
      renderPosts();
    } catch (error) {
      renderLoadError(error.message);
    } finally {
      list.setAttribute("aria-busy", "false");
    }
  }

  async function checkAuthentication() {
    try {
      const response = await fetch(SESSION_ENDPOINT, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await readJson(response);

      state.authenticated = response.ok ? payload.authenticated === true : null;
    } catch {
      state.authenticated = null;
    }
  }

  async function submitPost(event) {
    event.preventDefault();

    if (!postForm.reportValidity()) {
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "등록 중…";
    formMessage.textContent = "";

    try {
      const formData = new FormData(postForm);
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Object.fromEntries(formData.entries())),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          state.authenticated = false;
          formAuthNotice.hidden = false;
        }

        throw new Error(payload.message || "게시글을 등록하지 못했습니다.");
      }

      const [post] = normalizePosts([payload.post]);

      if (post) {
        state.posts.unshift(post);
      }

      postForm.reset();
      formDialog.close();
      renderPosts();
      showToast("게시글이 등록되었습니다.");
    } catch (error) {
      formMessage.textContent = error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "게시글 등록";
    }
  }

  function renderPosts() {
    const filteredPosts = state.posts.filter(matchesCurrentFilters);

    summary.replaceChildren(
      document.createTextNode("조건에 맞는 글 "),
      createElement("strong", String(filteredPosts.length)),
      document.createTextNode("개"),
    );

    if (!filteredPosts.length) {
      const empty = createElement("div", "", "recruit-empty");

      empty.append(
        createElement("strong", state.posts.length ? "조건에 맞는 글이 없어요." : "첫 번째 게시글을 기다리고 있어요."),
        createElement("p", state.posts.length ? "필터나 검색어를 바꿔 다시 찾아보세요." : "찾는 멤버나 합류하고 싶은 밴드를 소개해 주세요."),
      );
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(...filteredPosts.map(createPostCard));
  }

  function renderLoadError(message) {
    summary.textContent = "게시글을 불러오지 못했습니다.";
    const error = createElement("div", "", "recruit-error");
    const retryButton = createElement("button", "다시 불러오기", "ghost-button");

    retryButton.type = "button";
    retryButton.addEventListener("click", loadPosts);
    error.append(
      createElement("strong", "잠시 연결이 원활하지 않아요."),
      createElement("p", message || "잠시 후 다시 시도해 주세요."),
      retryButton,
    );
    list.replaceChildren(error);
  }

  function createPostCard(post) {
    const article = createElement("article", "", "recruit-post");
    const button = createElement("button", "", "recruit-post-button");
    const top = createElement("div", "", "post-card-top");
    const badges = createElement("div", "", "post-badges");
    const intent = createElement("span", post.intent, "post-intent-badge");
    const instrument = createElement("span", `${PART_CODES[post.instrument] || "PT"} · ${post.instrument}`, "post-instrument-badge");
    const copy = createElement("div", "", "post-card-copy");
    const meta = createElement("div", "", "post-meta-list");
    const bottom = createElement("div", "", "post-card-bottom");

    button.type = "button";
    button.setAttribute("aria-label", `${post.intent} ${post.instrument}: ${post.title}`);
    button.addEventListener("click", () => openPostDetail(post));
    intent.dataset.intent = post.intent;
    badges.append(intent, instrument);
    top.append(badges, createElement("time", formatRelativeTime(post.createdAt), "post-card-time"));
    copy.append(createElement("strong", post.title), createElement("p", post.content));

    const metaValues = [post.region, post.genre, post.schedule].filter(Boolean);
    metaValues.forEach((value, index) => {
      if (index > 0) {
        meta.append(createElement("i", "·"));
      }
      meta.append(createElement("span", value));
    });

    if (!metaValues.length) {
      meta.append(createElement("span", "활동 조건은 상세 글에서 확인해 주세요."));
    }

    bottom.append(
      createElement("span", post.authorName, "post-card-author"),
      createElement("span", "→", "post-card-arrow"),
    );
    button.append(top, copy, meta, bottom);
    article.append(button);
    return article;
  }

  function openPostDetail(post) {
    const body = createElement("div", "", "post-detail-body");
    const heading = createElement("div", "", "post-detail-heading");
    const badges = createElement("div", "", "post-badges");
    const intent = createElement("span", post.intent, "post-intent-badge");
    const facts = document.createElement("dl");

    facts.className = "post-detail-facts";
    intent.dataset.intent = post.intent;
    badges.append(intent, createElement("span", post.instrument, "post-instrument-badge"));
    heading.append(
      badges,
      createElement("h2", post.title),
      createElement("p", `${post.authorName} · ${formatDate(post.createdAt)}`, "post-detail-author"),
    );

    for (const [label, value] of [
      ["활동 지역", post.region || "협의"],
      ["장르", post.genre || "협의"],
      ["일정", post.schedule || "협의"],
    ]) {
      const item = document.createElement("div");

      item.append(createElement("dt", label), createElement("dd", value));
      facts.append(item);
    }

    const contact = createElement("div", "", "post-detail-contact");
    contact.append(createElement("span", "연락 방법"), createElement("strong", post.contact));
    body.append(heading, facts, createElement("p", post.content, "post-detail-content"), contact);
    detail.replaceChildren(body);
    detailDialog.showModal();
  }

  function matchesCurrentFilters(post) {
    const matchesIntent = state.intent === "전체" || post.intent === state.intent;
    const matchesInstrument = state.instrument === "전체" || post.instrument === state.instrument;
    const searchableText = [
      post.title,
      post.region,
      post.genre,
      post.schedule,
      post.content,
      post.authorName,
    ].join(" ").toLocaleLowerCase("ko");

    return matchesIntent && matchesInstrument && (!state.search || searchableText.includes(state.search));
  }

  function setActiveFilter(selector, activeButton) {
    for (const button of document.querySelectorAll(selector)) {
      const active = button === activeButton;

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function normalizePosts(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((post) => ({
        id: String(post?.id || ""),
        intent: String(post?.intent || ""),
        instrument: String(post?.instrument || ""),
        title: String(post?.title || "").trim(),
        region: String(post?.region || "").trim(),
        genre: String(post?.genre || "").trim(),
        schedule: String(post?.schedule || "").trim(),
        content: String(post?.content || "").trim(),
        contact: String(post?.contact || "").trim(),
        authorName: String(post?.authorName || "Cue Sheet 멤버").trim(),
        createdAt: post?.createdAt || null,
      }))
      .filter((post) => post.id && post.title && post.intent && post.instrument);
  }

  function createElement(tagName, text = "", className = "") {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }
    element.textContent = text;
    return element;
  }

  function closeFromBackdrop(event) {
    if (event.target === event.currentTarget) {
      event.currentTarget.close();
    }
  }

  function formatRelativeTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "방금 전";
    }

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (seconds < 60) return "방금 전";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
    return formatDate(value);
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "날짜 정보 없음";
    }

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }
})();
