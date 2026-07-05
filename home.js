(() => {
  const memberDirectoryList = document.querySelector("#memberDirectoryList");

  if (!memberDirectoryList) {
    return;
  }

  loadMemberDirectory();

  async function loadMemberDirectory() {
    try {
      const response = await fetch("/api/member/directory", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await safeReadJson(response);

      if (!response.ok) {
        return;
      }

      const members = normalizeMembers(payload.members);

      if (!members.length) {
        return;
      }

      memberDirectoryList.replaceChildren(...members.map(createDirectoryItem));
    } catch {
      // Static fallback members stay visible when the API is unavailable.
    }
  }

  async function safeReadJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function normalizeMembers(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((member) => ({
        id: String(member?.id || ""),
        name: String(member?.name || "").trim() || "이름 없는 회원",
        pictureUrl: String(member?.pictureUrl || "").trim(),
        region: String(member?.region || "").trim(),
        position: String(member?.position || "").trim(),
        genre: String(member?.genre || "").trim(),
        memo: String(member?.memo || "").trim(),
      }))
      .filter((member) => member.id);
  }

  function createDirectoryItem(member) {
    const item = document.createElement("article");
    const main = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("p");
    const memo = document.createElement("small");
    const avatar = createMemberAvatar(member);

    item.className = "directory-item";
    title.textContent = member.name;
    meta.textContent = [member.position, member.region, member.genre].filter(Boolean).join(" · ") || "프로필 준비 중";
    memo.textContent = member.memo || "소개가 아직 없습니다.";

    main.append(title, meta, memo);
    item.append(avatar, main);
    return item;
  }

  function createMemberAvatar(member) {
    if (member.pictureUrl) {
      const image = document.createElement("img");

      image.className = "directory-avatar directory-avatar-image";
      image.src = member.pictureUrl;
      image.alt = `${member.name} 프로필사진`;
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      return image;
    }

    const avatar = document.createElement("span");

    avatar.className = "directory-avatar";
    avatar.textContent = getProfileInitial(member.name);
    return avatar;
  }

  function getProfileInitial(value) {
    const text = String(value || "").trim();

    return (text[0] || "M").toUpperCase();
  }
})();
