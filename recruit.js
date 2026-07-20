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
    activePostId: "",
    commentLoadVersion: 0,
    commentsByPostId: new Map(),
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
    detailDialog?.addEventListener("close", () => {
      state.activePostId = "";
      state.commentLoadVersion += 1;
    });
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
      updateCommentComposerAuthState();
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
    const bottomMeta = createElement("span", "", "post-card-bottom-meta");
    const commentCount = createElement("span", `댓글 ${post.commentCount}`, "post-card-comment-count");

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

    commentCount.dataset.commentCountPost = post.id;
    bottomMeta.append(commentCount, createElement("span", "→", "post-card-arrow"));
    bottom.append(createAuthorIdentity(post, "post-card-author"), bottomMeta);
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
    const author = createElement("div", "", "post-detail-author");

    facts.className = "post-detail-facts";
    intent.dataset.intent = post.intent;
    badges.append(intent, createElement("span", post.instrument, "post-instrument-badge"));
    author.append(
      createAuthorIdentity(post, "post-detail-author-identity"),
      createElement("time", formatDate(post.createdAt)),
    );
    heading.append(
      badges,
      createElement("h2", post.title),
      author,
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
    body.append(
      heading,
      facts,
      createElement("p", post.content, "post-detail-content"),
      contact,
      createCommentSection(post),
    );
    detail.replaceChildren(body);
    state.activePostId = post.id;
    detailDialog.showModal();
    void loadComments(post.id);
  }

  function createCommentSection(post) {
    const section = createElement("section", "", "post-comments");
    const header = createElement("div", "", "post-comments-header");
    const title = createElement("strong", "댓글", "post-comments-title");
    const count = createElement("span", `${post.commentCount}개`, "post-comments-count");
    const listElement = createElement("div", "", "post-comment-list");
    const form = document.createElement("form");
    const textarea = document.createElement("textarea");
    const formFooter = createElement("div", "", "post-comment-form-footer");
    const notice = createElement("p", "", "post-comment-login-notice");
    const loginLink = createElement("a", "로그인");
    const submit = createElement("button", "댓글 등록", "primary-button post-comment-submit");
    const message = createElement("p", "", "post-comment-message");

    section.setAttribute("aria-labelledby", "postCommentsTitle");
    title.id = "postCommentsTitle";
    count.id = "postCommentsCount";
    count.dataset.commentCountPost = post.id;
    header.append(title, count);

    listElement.id = "recruitCommentList";
    listElement.setAttribute("aria-live", "polite");
    listElement.setAttribute("aria-busy", "true");
    listElement.append(createElement("div", "댓글을 불러오는 중입니다.", "post-comments-loading"));

    form.className = "post-comment-form";
    form.dataset.postId = post.id;
    form.addEventListener("submit", submitComment);
    textarea.name = "content";
    textarea.maxLength = 800;
    textarea.required = true;
    textarea.placeholder = "함께하고 싶은 마음이나 궁금한 점을 남겨 보세요.";
    textarea.setAttribute("aria-label", "댓글 내용");
    loginLink.href = "./login.html";
    notice.append("댓글을 작성하려면 ", loginLink, "해 주세요.");
    submit.type = "submit";
    submit.dataset.commentSubmit = "";
    formFooter.append(notice, submit);
    message.className = "post-comment-message";
    message.dataset.commentMessage = "";
    message.setAttribute("role", "alert");
    form.append(textarea, formFooter, message);
    section.append(header, listElement, form);
    updateCommentComposerAuthState(section);
    return section;
  }

  async function loadComments(postId) {
    const listElement = document.querySelector("#recruitCommentList");
    const loadVersion = ++state.commentLoadVersion;

    if (!listElement || state.activePostId !== postId) {
      return;
    }

    listElement.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(`${API_ENDPOINT}/${encodeURIComponent(postId)}/comments`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(payload.message || "댓글을 불러오지 못했습니다.");
      }

      if (state.activePostId !== postId || state.commentLoadVersion !== loadVersion) {
        return;
      }

      const comments = normalizeComments(payload.comments);

      state.commentsByPostId.set(postId, comments);
      renderComments(postId, comments);
      updatePostCommentCount(postId, comments.length);
    } catch (error) {
      if (state.activePostId === postId && state.commentLoadVersion === loadVersion) {
        renderCommentLoadError(postId, error.message);
      }
    } finally {
      listElement.setAttribute("aria-busy", "false");
    }
  }

  async function submitComment(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const postId = String(form.dataset.postId || "");
    const textarea = form.elements.content;
    const submit = form.querySelector("[data-comment-submit]");
    const message = form.querySelector("[data-comment-message]");
    const content = String(textarea?.value || "").trim();

    if (!content || !postId || state.activePostId !== postId) {
      textarea?.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "등록 중…";
    message.textContent = "";

    try {
      const response = await fetch(`${API_ENDPOINT}/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          state.authenticated = false;
          updateCommentComposerAuthState();
        }

        throw new Error(payload.message || "댓글을 등록하지 못했습니다.");
      }

      const [comment] = normalizeComments([payload.comment]);

      if (!comment || state.activePostId !== postId) {
        return;
      }

      state.commentLoadVersion += 1;
      const comments = [...(state.commentsByPostId.get(postId) || []), comment];

      state.commentsByPostId.set(postId, comments);
      textarea.value = "";
      renderComments(postId, comments);
      updatePostCommentCount(postId, comments.length);
      showToast("댓글이 등록되었습니다.");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = state.authenticated === false;
      submit.textContent = "댓글 등록";
    }
  }

  function renderComments(postId, comments) {
    const listElement = document.querySelector("#recruitCommentList");

    if (!listElement || state.activePostId !== postId) {
      return;
    }

    if (!comments.length) {
      const empty = createElement("div", "", "post-comments-empty");

      empty.append(
        createElement("strong", "아직 댓글이 없어요."),
        createElement("p", "첫 댓글로 대화를 시작해 보세요."),
      );
      listElement.replaceChildren(empty);
      return;
    }

    listElement.replaceChildren(...comments.map(createCommentItem));
  }

  function createCommentItem(comment) {
    const item = createElement("article", "", "post-comment-item");
    const header = createElement("header", "", "post-comment-item-header");

    header.append(
      createAuthorIdentity(comment, "post-comment-author"),
      createElement("time", formatRelativeTime(comment.createdAt)),
    );
    item.append(header, createElement("p", comment.content, "post-comment-content"));
    return item;
  }

  function renderCommentLoadError(postId, message) {
    const listElement = document.querySelector("#recruitCommentList");
    const error = createElement("div", "", "post-comments-empty");
    const retry = createElement("button", "다시 불러오기", "ghost-button");

    if (!listElement || state.activePostId !== postId) {
      return;
    }

    retry.type = "button";
    retry.addEventListener("click", () => loadComments(postId));
    error.append(createElement("strong", "댓글을 불러오지 못했습니다."), createElement("p", message), retry);
    listElement.replaceChildren(error);
  }

  function updateCommentComposerAuthState(root = document) {
    const form = root.querySelector?.(".post-comment-form");

    if (!form) {
      return;
    }

    const loggedOut = state.authenticated === false;
    const notice = form.querySelector(".post-comment-login-notice");
    const textarea = form.elements.content;
    const submit = form.querySelector("[data-comment-submit]");

    notice.hidden = !loggedOut;
    textarea.disabled = loggedOut;
    submit.disabled = loggedOut;
  }

  function updatePostCommentCount(postId, count) {
    const normalizedCount = Math.max(0, Number(count) || 0);
    const post = state.posts.find((item) => item.id === postId);

    if (post) {
      post.commentCount = normalizedCount;
    }

    for (const element of document.querySelectorAll("[data-comment-count-post]")) {
      if (element.dataset.commentCountPost !== postId) {
        continue;
      }

      element.textContent = element.id === "postCommentsCount"
        ? `${normalizedCount}개`
        : `댓글 ${normalizedCount}`;
    }
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
      post.authorId,
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
        commentCount: Math.max(0, Number(post?.commentCount) || 0),
        authorName: String(post?.authorName || "Cue Sheet 멤버").trim(),
        authorId: String(post?.authorId || "@member").trim(),
        authorPictureUrl: String(post?.authorPictureUrl || "").trim(),
        createdAt: post?.createdAt || null,
      }))
      .filter((post) => post.id && post.title && post.intent && post.instrument);
  }

  function normalizeComments(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((comment) => ({
        id: String(comment?.id || ""),
        postId: String(comment?.postId || ""),
        content: String(comment?.content || "").trim(),
        authorName: String(comment?.authorName || "Cue Sheet 멤버").trim(),
        authorId: String(comment?.authorId || "@member").trim(),
        authorPictureUrl: String(comment?.authorPictureUrl || "").trim(),
        createdAt: comment?.createdAt || null,
      }))
      .filter((comment) => comment.id && comment.postId && comment.content);
  }

  function createAuthorIdentity(post, className) {
    const identity = createElement("span", "", `post-author-identity ${className}`);
    const copy = createElement("span", "", "post-author-copy");

    copy.append(
      createElement("strong", post.authorName),
      createElement("small", post.authorId),
    );
    identity.append(createAuthorAvatar(post), copy);
    return identity;
  }

  function createAuthorAvatar(post) {
    const fallback = createElement("span", getAuthorInitial(post), "post-author-avatar post-author-avatar-fallback");

    if (!post.authorPictureUrl) {
      return fallback;
    }

    const image = document.createElement("img");

    image.className = "post-author-avatar";
    image.src = post.authorPictureUrl;
    image.alt = `${post.authorName} 프로필 사진`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.replaceWith(fallback), { once: true });
    return image;
  }

  function getAuthorInitial(post) {
    const value = String(post.authorName || post.authorId || "M").trim();

    return (value[0] || "M").toUpperCase();
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
