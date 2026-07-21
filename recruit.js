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
  const REGION_CATEGORIES = new Set([
    "서울",
    "경기",
    "인천",
    "강원",
    "대전·세종·충청",
    "광주·전라",
    "대구·경북",
    "부산·울산·경남",
    "제주",
    "전국·온라인",
  ]);
  const state = {
    posts: [],
    intent: "전체",
    region: "전체",
    instruments: new Set(),
    search: "",
    authenticated: null,
    userId: "",
    activePostId: "",
    commentLoadVersion: 0,
    commentsByPostId: new Map(),
  };

  const list = document.querySelector("#recruitPostList");
  const summary = document.querySelector("#recruitResultSummary");
  const searchInput = document.querySelector("#recruitSearchInput");
  const selectionSummary = document.querySelector("#recruitSelectionSummary");
  const resetFiltersButton = document.querySelector("#resetRecruitFiltersButton");
  const advancedSearch = document.querySelector("#recruitAdvancedSearch");
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

    for (const button of document.querySelectorAll("[data-region-filter]")) {
      button.addEventListener("click", () => {
        state.region = button.dataset.regionFilter;
        setActiveFilter("[data-region-filter]", button);
        renderPosts();
      });
    }

    for (const button of document.querySelectorAll("[data-instrument-filter]")) {
      button.addEventListener("click", () => {
        const instrument = button.dataset.instrumentFilter;

        if (instrument === "전체") {
          state.instruments.clear();
        } else if (state.instruments.has(instrument)) {
          state.instruments.delete(instrument);
        } else {
          state.instruments.add(instrument);
        }

        syncInstrumentFilterButtons();
        renderPosts();
      });
    }

    searchInput?.addEventListener("input", () => {
      state.search = searchInput.value.trim().toLocaleLowerCase("ko");
      renderPosts();
    });

    resetFiltersButton?.addEventListener("click", resetFilters);

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
      state.userId = state.authenticated ? String(payload.userId || "") : "";
      updateCommentComposerAuthState();
      updateDirectMessageActionState();
    } catch {
      state.authenticated = null;
      state.userId = "";
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
      const instruments = formData.getAll("instruments").map(String);

      if (!instruments.length) {
        formMessage.textContent = "악기 파트를 하나 이상 선택해 주세요.";
        postForm.querySelector('[name="instruments"]')?.focus();
        return;
      }

      const postPayload = Object.fromEntries(formData.entries());

      delete postPayload.instruments;
      postPayload.instruments = instruments;

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postPayload),
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

    renderFilterSelectionSummary();

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
    const copy = createElement("div", "", "post-card-copy");
    const meta = createElement("div", "", "post-meta-list");
    const bottom = createElement("div", "", "post-card-bottom");
    const bottomMeta = createElement("span", "", "post-card-bottom-meta");
    const commentCount = createElement("span", `댓글 ${post.commentCount}`, "post-card-comment-count");
    const instrumentsLabel = post.instruments.join(", ");

    button.type = "button";
    button.setAttribute("aria-label", `${post.intent} ${instrumentsLabel}: ${post.title}`);
    button.addEventListener("click", () => openPostDetail(post));
    intent.dataset.intent = post.intent;
    badges.append(intent);
    appendInstrumentBadges(badges, post.instruments, true);
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
    badges.append(intent);
    appendInstrumentBadges(badges, post.instruments);
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
      createDirectMessageSection(post),
      createCommentSection(post),
    );
    detail.replaceChildren(body);
    state.activePostId = post.id;
    detailDialog.showModal();
    void loadComments(post.id);
  }

  function createDirectMessageSection(post) {
    const section = createElement("section", "", "post-direct-message");
    const header = createElement("div", "", "post-direct-message-header");
    const copy = createElement("div", "", "post-direct-message-copy");
    const toggle = createElement("button", "쪽지 보내기", "primary-button post-direct-message-toggle");
    const form = document.createElement("form");
    const textarea = document.createElement("textarea");
    const notice = createElement("p", "", "post-direct-message-notice");
    const loginLink = createElement("a", "로그인");
    const footer = createElement("div", "", "post-direct-message-footer");
    const cancel = createElement("button", "취소", "ghost-button");
    const submit = createElement("button", "쪽지 전송", "primary-button");
    const message = createElement("p", "", "post-direct-message-status");

    section.dataset.directMessagePanel = "";
    section.dataset.authorUserId = post.authorUserId;
    copy.append(
      createElement("strong", `${post.authorName}님에게 쪽지 보내기`),
      createElement("span", "보낸 쪽지는 작성자의 작업공간 메시지함에 전달됩니다."),
    );
    toggle.type = "button";
    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;

      if (!form.hidden) {
        updateDirectMessageActionState(section);
        (state.authenticated === false ? loginLink : textarea).focus();
      }
    });
    header.append(copy, toggle);

    form.className = "post-direct-message-form";
    form.dataset.postId = post.id;
    form.hidden = true;
    form.addEventListener("submit", submitDirectMessage);
    textarea.name = "body";
    textarea.maxLength = 1000;
    textarea.required = true;
    textarea.placeholder = "합주 제안이나 궁금한 내용을 입력해 주세요.";
    textarea.setAttribute("aria-label", `${post.authorName}님에게 보낼 쪽지 내용`);
    loginLink.href = "./login.html";
    notice.append("쪽지를 보내려면 ", loginLink, "해 주세요.");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      form.reset();
      form.hidden = true;
      message.textContent = "";
      toggle.focus();
    });
    submit.type = "submit";
    submit.dataset.directMessageSubmit = "";
    footer.append(notice, cancel, submit);
    message.dataset.directMessageStatus = "";
    message.setAttribute("role", "alert");
    form.append(textarea, footer, message);
    section.append(header, form);
    updateDirectMessageActionState(section);
    return section;
  }

  async function submitDirectMessage(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const postId = String(form.dataset.postId || "");
    const textarea = form.elements.body;
    const submit = form.querySelector("[data-direct-message-submit]");
    const message = form.querySelector("[data-direct-message-status]");
    const body = String(textarea?.value || "").trim();

    if (!body || !postId || !form.reportValidity()) {
      textarea?.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "전송 중…";
    message.textContent = "";

    try {
      const response = await fetch(`${API_ENDPOINT}/${encodeURIComponent(postId)}/message`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          state.authenticated = false;
          state.userId = "";
          updateDirectMessageActionState();
        }

        if (payload.error === "cannot_message_self") {
          form.closest("[data-direct-message-panel]").hidden = true;
        }

        throw new Error(payload.message || "쪽지를 보내지 못했습니다.");
      }

      form.reset();
      form.hidden = true;
      showToast("쪽지를 보냈습니다.");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = state.authenticated === false;
      submit.textContent = "쪽지 전송";
    }
  }

  function updateDirectMessageActionState(root = document) {
    const panels = root.matches?.("[data-direct-message-panel]")
      ? [root]
      : root.querySelectorAll?.("[data-direct-message-panel]") || [];

    for (const panel of panels) {
      const isOwnPost = Boolean(
        state.authenticated === true
        && state.userId
        && panel.dataset.authorUserId === state.userId,
      );
      const form = panel.querySelector(".post-direct-message-form");
      const loggedOut = state.authenticated === false;

      panel.hidden = !panel.dataset.authorUserId || isOwnPost;

      if (!form) {
        continue;
      }

      form.elements.body.disabled = loggedOut;
      form.querySelector(".post-direct-message-notice").hidden = !loggedOut;
      form.querySelector("[data-direct-message-submit]").disabled = loggedOut;
    }
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
    const matchesRegion = state.region === "전체" || post.regionCategory === state.region;
    const matchesInstrument = !state.instruments.size
      || post.instruments.some((instrument) => state.instruments.has(instrument));
    const searchableText = [
      post.title,
      post.region,
      post.genre,
      post.schedule,
      post.content,
      post.authorName,
      post.authorId,
    ].join(" ").toLocaleLowerCase("ko");

    return matchesIntent && matchesRegion && matchesInstrument
      && (!state.search || searchableText.includes(state.search));
  }

  function resetFilters() {
    state.intent = "전체";
    state.region = "전체";
    state.instruments.clear();
    state.search = "";

    if (searchInput) {
      searchInput.value = "";
    }

    setActiveFilter("[data-intent-filter]", document.querySelector('[data-intent-filter="전체"]'));
    setActiveFilter("[data-region-filter]", document.querySelector('[data-region-filter="전체"]'));
    syncInstrumentFilterButtons();

    if (advancedSearch) {
      advancedSearch.open = false;
    }

    renderPosts();
  }

  function renderFilterSelectionSummary() {
    if (!selectionSummary) {
      return;
    }

    const intentLabel = state.intent === "전체" ? "전체 모집" : state.intent;
    const regionLabel = state.region === "전체" ? "전체 지역" : state.region;

    selectionSummary.textContent = `${intentLabel} · ${regionLabel}`;
  }

  function setActiveFilter(selector, activeButton) {
    for (const button of document.querySelectorAll(selector)) {
      const active = button === activeButton;

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function syncInstrumentFilterButtons() {
    for (const button of document.querySelectorAll("[data-instrument-filter]")) {
      const instrument = button.dataset.instrumentFilter;
      const active = instrument === "전체"
        ? state.instruments.size === 0
        : state.instruments.has(instrument);

      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function normalizePosts(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((post) => {
        const instruments = normalizeInstrumentList(post?.instruments, post?.instrument);
        const regionCategory = normalizeRegionCategory(post?.regionCategory || post?.region);

        return {
          id: String(post?.id || ""),
          intent: String(post?.intent || ""),
          instrument: instruments[0] || "",
          instruments,
          title: String(post?.title || "").trim(),
          region: regionCategory,
          regionCategory,
          genre: String(post?.genre || "").trim(),
          schedule: String(post?.schedule || "").trim(),
          content: String(post?.content || "").trim(),
          contact: String(post?.contact || "").trim(),
          commentCount: Math.max(0, Number(post?.commentCount) || 0),
          authorUserId: String(post?.authorUserId || ""),
          authorName: String(post?.authorName || "Cue Sheet 멤버").trim(),
          authorId: String(post?.authorId || "@member").trim(),
          authorPictureUrl: String(post?.authorPictureUrl || "").trim(),
          createdAt: post?.createdAt || null,
        };
      })
      .filter((post) => post.id && post.title && post.intent && post.instruments.length);
  }

  function normalizeInstrumentList(value, legacyValue = "") {
    const instruments = Array.isArray(value) && value.length ? value : [legacyValue];

    return [...new Set(instruments
      .map((instrument) => String(instrument || "").trim())
      .filter((instrument) => PART_CODES[instrument]))];
  }

  function normalizeRegionCategory(value) {
    const region = String(value || "").trim();

    return REGION_CATEGORIES.has(region) ? region : "전국·온라인";
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

  function appendInstrumentBadges(container, instruments, showCode = false) {
    for (const instrument of instruments) {
      const label = showCode
        ? `${PART_CODES[instrument] || "PT"} · ${instrument}`
        : instrument;

      container.append(createElement("span", label, "post-instrument-badge"));
    }
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
