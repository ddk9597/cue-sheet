(() => {
  const API_ENDPOINT = "/api/community";
  const SESSION_ENDPOINT = "/api/auth/session";
  const CATEGORIES = new Set(["자유", "합주·친목", "공연·모임", "정보공유"]);
  const state = {
    posts: [],
    category: "전체",
    search: "",
    authenticated: null,
    activePostId: "",
    commentLoadVersion: 0,
  };

  const list = document.querySelector("#communityPostList");
  const summary = document.querySelector("#communityResultSummary");
  const searchInput = document.querySelector("#communitySearchInput");
  const openFormButton = document.querySelector("#openCommunityFormButton");
  const formDialog = document.querySelector("#communityFormDialog");
  const postForm = document.querySelector("#communityPostForm");
  const formMessage = document.querySelector("#communityFormMessage");
  const formAuthNotice = document.querySelector("#communityFormAuthNotice");
  const submitPostButton = document.querySelector("#submitCommunityPostButton");
  const detailDialog = document.querySelector("#communityDetailDialog");
  const detail = document.querySelector("#communityPostDetail");
  const toast = document.querySelector("#communityToast");
  let toastTimer = null;

  if (!list || !summary) {
    return;
  }

  bindEvents();
  void Promise.all([loadPosts(), checkAuthentication()]);

  function bindEvents() {
    for (const button of document.querySelectorAll("[data-community-category]")) {
      button.addEventListener("click", () => {
        state.category = button.dataset.communityCategory;
        setActiveCategoryButton(button);
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

    for (const button of document.querySelectorAll("[data-close-community-form]")) {
      button.addEventListener("click", () => formDialog.close());
    }

    for (const button of document.querySelectorAll("[data-close-community-detail]")) {
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
        throw new Error(payload.message || "커뮤니티 글을 불러오지 못했습니다.");
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

    submitPostButton.disabled = true;
    submitPostButton.textContent = "등록 중…";
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

        throw new Error(payload.message || "커뮤니티 글을 등록하지 못했습니다.");
      }

      const [post] = normalizePosts([payload.post]);

      if (post) {
        state.posts.unshift(post);
      }

      postForm.reset();
      formDialog.close();
      renderPosts();
      showToast("커뮤니티 글이 등록되었습니다.");
    } catch (error) {
      formMessage.textContent = error.message;
    } finally {
      submitPostButton.disabled = false;
      submitPostButton.textContent = "게시글 등록";
    }
  }

  function renderPosts() {
    const filteredPosts = state.posts.filter(matchesCurrentFilters);

    summary.replaceChildren(
      document.createTextNode("조건에 맞는 이야기 "),
      createElement("strong", String(filteredPosts.length)),
      document.createTextNode("개"),
    );

    if (!filteredPosts.length) {
      const empty = createElement("div", "", "community-empty");

      empty.append(
        createElement("strong", state.posts.length ? "조건에 맞는 글이 없어요." : "첫 번째 이야기를 기다리고 있어요."),
        createElement("p", state.posts.length ? "분류나 검색어를 바꿔 다시 찾아보세요." : "음악 이야기로 커뮤니티를 시작해 보세요."),
      );
      list.replaceChildren(empty);
      return;
    }

    list.replaceChildren(...filteredPosts.map(createPostCard));
  }

  function renderLoadError(message) {
    summary.textContent = "커뮤니티 글을 불러오지 못했습니다.";
    const error = createElement("div", "", "community-error");
    const retry = createElement("button", "다시 불러오기", "ghost-button");

    retry.type = "button";
    retry.addEventListener("click", loadPosts);
    error.append(
      createElement("strong", "잠시 연결이 원활하지 않아요."),
      createElement("p", message || "잠시 후 다시 시도해 주세요."),
      retry,
    );
    list.replaceChildren(error);
  }

  function createPostCard(post) {
    const article = createElement("article", "", "community-post");
    const button = createElement("button", "", "community-post-button");
    const top = createElement("div", "", "community-post-top");
    const copy = createElement("div", "", "community-post-copy");
    const footer = createElement("div", "", "community-post-footer");
    const count = createElement("span", `댓글 ${post.commentCount}`, "community-comment-count");

    button.type = "button";
    button.setAttribute("aria-label", `${post.category}: ${post.title}`);
    button.addEventListener("click", () => openPostDetail(post));
    top.append(
      createElement("span", post.category, "community-category-badge"),
      createElement("time", formatRelativeTime(post.createdAt), "community-post-time"),
    );
    copy.append(createElement("strong", post.title), createElement("p", post.content));
    count.dataset.communityCommentCountPost = post.id;
    footer.append(createAuthorIdentity(post), count);
    button.append(top, copy, footer);
    article.append(button);
    return article;
  }

  function openPostDetail(post) {
    const body = createElement("div", "", "community-detail-body");
    const heading = createElement("div", "", "community-detail-heading");
    const authorRow = createElement("div", "", "community-post-footer");

    authorRow.append(
      createAuthorIdentity(post),
      createElement("time", formatDate(post.createdAt), "community-post-time"),
    );
    heading.append(
      createElement("span", post.category, "community-category-badge"),
      createElement("h2", post.title),
      authorRow,
    );
    body.append(
      heading,
      createElement("p", post.content, "community-detail-content"),
      createCommentSection(post),
    );
    detail.replaceChildren(body);
    state.activePostId = post.id;
    detailDialog.showModal();
    void loadComments(post.id);
  }

  function createCommentSection(post) {
    const section = createElement("section", "", "community-comments");
    const header = createElement("div", "", "community-comment-header");
    const title = createElement("strong", "댓글", "community-comments-title");
    const count = createElement("span", `${post.commentCount}개`, "community-comments-count");
    const commentList = createElement("div", "", "community-comment-list");
    const form = document.createElement("form");
    const textarea = document.createElement("textarea");
    const footer = createElement("div", "", "community-comment-form-footer");
    const notice = createElement("p", "", "community-comment-login-notice");
    const loginLink = createElement("a", "로그인");
    const submit = createElement("button", "댓글 등록", "primary-button");
    const message = createElement("p", "", "community-comment-message");

    count.id = "communityCommentsCount";
    count.dataset.communityCommentCountPost = post.id;
    header.append(title, count);
    commentList.id = "communityCommentList";
    commentList.setAttribute("aria-live", "polite");
    commentList.setAttribute("aria-busy", "true");
    commentList.append(createElement("div", "댓글을 불러오는 중입니다.", "community-comments-loading"));
    form.className = "community-comment-form";
    form.dataset.postId = post.id;
    form.addEventListener("submit", submitComment);
    textarea.name = "content";
    textarea.maxLength = 800;
    textarea.required = true;
    textarea.placeholder = "대화를 이어갈 댓글을 남겨 보세요.";
    loginLink.href = "./login.html";
    notice.append("댓글을 작성하려면 ", loginLink, "해 주세요.");
    submit.type = "submit";
    submit.dataset.communityCommentSubmit = "";
    footer.append(notice, submit);
    message.dataset.communityCommentMessage = "";
    message.setAttribute("role", "alert");
    form.append(textarea, footer, message);
    section.append(header, commentList, form);
    updateCommentComposerAuthState(section);
    return section;
  }

  async function loadComments(postId) {
    const commentList = document.querySelector("#communityCommentList");
    const loadVersion = ++state.commentLoadVersion;

    if (!commentList || state.activePostId !== postId) {
      return;
    }

    commentList.setAttribute("aria-busy", "true");

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

      renderComments(comments);
      updatePostCommentCount(postId, comments.length);
    } catch (error) {
      if (state.activePostId === postId && state.commentLoadVersion === loadVersion) {
        renderCommentError(error.message);
      }
    } finally {
      if (state.activePostId === postId && state.commentLoadVersion === loadVersion) {
        commentList.setAttribute("aria-busy", "false");
      }
    }
  }

  async function submitComment(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const postId = String(form.dataset.postId || "");
    const textarea = form.elements.content;
    const submit = form.querySelector("[data-community-comment-submit]");
    const message = form.querySelector("[data-community-comment-message]");
    const content = String(textarea?.value || "").trim();

    if (!content || !postId || !form.reportValidity()) {
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
      const commentList = document.querySelector("#communityCommentList");

      if (comment && commentList && state.activePostId === postId) {
        const empty = commentList.querySelector(".community-comments-empty");

        empty?.remove();
        commentList.append(createCommentItem(comment));
        updatePostCommentCount(postId, commentList.children.length);
      }

      form.reset();
      showToast("댓글이 등록되었습니다.");
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = state.authenticated === false;
      submit.textContent = "댓글 등록";
    }
  }

  function renderComments(comments) {
    const commentList = document.querySelector("#communityCommentList");

    if (!commentList) {
      return;
    }

    if (!comments.length) {
      commentList.replaceChildren(createElement("div", "첫 댓글로 대화를 시작해 보세요.", "community-comments-empty"));
      return;
    }

    commentList.replaceChildren(...comments.map(createCommentItem));
  }

  function createCommentItem(comment) {
    const item = createElement("article", "", "community-comment-item");
    const header = createElement("header", "", "community-comment-header");

    header.append(
      createAuthorIdentity(comment),
      createElement("time", formatRelativeTime(comment.createdAt), "community-comment-time"),
    );
    item.append(header, createElement("p", comment.content, "community-comment-content"));
    return item;
  }

  function renderCommentError(message) {
    const commentList = document.querySelector("#communityCommentList");
    const error = createElement("div", "", "community-comments-empty");
    const retry = createElement("button", "다시 불러오기", "ghost-button");

    if (!commentList || !state.activePostId) {
      return;
    }

    retry.type = "button";
    retry.addEventListener("click", () => loadComments(state.activePostId));
    error.append(createElement("strong", message || "댓글을 불러오지 못했습니다."), retry);
    commentList.replaceChildren(error);
  }

  function updateCommentComposerAuthState(root = document) {
    const form = root.querySelector?.(".community-comment-form");

    if (!form) {
      return;
    }

    const loggedOut = state.authenticated === false;

    form.elements.content.disabled = loggedOut;
    form.querySelector(".community-comment-login-notice").hidden = !loggedOut;
    form.querySelector("[data-community-comment-submit]").disabled = loggedOut;
  }

  function updatePostCommentCount(postId, count) {
    const normalizedCount = Math.max(0, Number(count) || 0);
    const post = state.posts.find((item) => item.id === postId);

    if (post) {
      post.commentCount = normalizedCount;
    }

    for (const element of document.querySelectorAll("[data-community-comment-count-post]")) {
      if (element.dataset.communityCommentCountPost !== postId) {
        continue;
      }

      element.textContent = element.id === "communityCommentsCount"
        ? `${normalizedCount}개`
        : `댓글 ${normalizedCount}`;
    }
  }

  function matchesCurrentFilters(post) {
    const matchesCategory = state.category === "전체" || post.category === state.category;
    const searchableText = [post.title, post.content, post.authorName, post.authorId]
      .join(" ")
      .toLocaleLowerCase("ko");

    return matchesCategory && (!state.search || searchableText.includes(state.search));
  }

  function setActiveCategoryButton(activeButton) {
    for (const button of document.querySelectorAll("[data-community-category]")) {
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
        category: String(post?.category || ""),
        title: String(post?.title || "").trim(),
        content: String(post?.content || "").trim(),
        commentCount: Math.max(0, Number(post?.commentCount) || 0),
        authorUserId: String(post?.authorUserId || ""),
        authorName: String(post?.authorName || "Cue Sheet 멤버").trim(),
        authorId: String(post?.authorId || "@member").trim(),
        authorPictureUrl: String(post?.authorPictureUrl || "").trim(),
        createdAt: post?.createdAt || null,
      }))
      .filter((post) => post.id && CATEGORIES.has(post.category) && post.title && post.content);
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

  function createAuthorIdentity(item) {
    const identity = createElement("span", "", "community-author");
    const copy = createElement("span", "", "community-author-copy");

    copy.append(
      createElement("strong", item.authorName),
      createElement("small", item.authorId),
    );
    identity.append(createAuthorAvatar(item), copy);
    return identity;
  }

  function createAuthorAvatar(item) {
    const initial = String(item.authorName || item.authorId || "M").trim()[0] || "M";
    const fallback = createElement("span", initial.toUpperCase(), "community-author-avatar community-author-avatar-fallback");

    if (!item.authorPictureUrl) {
      return fallback;
    }

    const image = document.createElement("img");

    image.className = "community-author-avatar";
    image.src = item.authorPictureUrl;
    image.alt = `${item.authorName} 프로필 사진`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => image.replaceWith(fallback), { once: true });
    return image;
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

    if (Number.isNaN(date.getTime())) return "방금 전";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (seconds < 60) return "방금 전";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
    return formatDate(value);
  }

  function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "날짜 정보 없음";
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
