(() => {
  const memberDirectoryList = document.querySelector("#memberDirectoryList");
  const bandList = document.querySelector("#bandList");

  if (!memberDirectoryList && !bandList) {
    return;
  }

  loadMemberDirectory();
  loadBandList();

  async function loadMemberDirectory() {
    if (!memberDirectoryList) {
      return;
    }

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

  async function loadBandList() {
    if (!bandList) {
      return;
    }

    try {
      const response = await fetch("/api/member/bands", {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });
      const payload = await safeReadJson(response);

      if (!response.ok) {
        renderBandEmptyState("밴드 목록을 불러오지 못했습니다.", "잠시 후 다시 확인해 주세요.");
        return;
      }

      const bands = normalizeBands(payload.bands);

      if (!bands.length) {
        renderBandEmptyState("구성된 밴드가 아직 없습니다.", "내 작업 공간에서 그룹을 만들면 이곳에 표시됩니다.");
        return;
      }

      bandList.replaceChildren(...bands.map(createBandItem));
    } catch {
      renderBandEmptyState("밴드 목록을 불러오지 못했습니다.", "네트워크 상태를 확인해 주세요.");
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

  function normalizeBands(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((band) => ({
        id: String(band?.id || ""),
        name: String(band?.name || "").trim() || "이름 없는 밴드",
        description: String(band?.description || "").trim(),
        memberCount: Number(band?.memberCount || 0),
        ownerName: String(band?.ownerName || "").trim(),
        ownerRegion: String(band?.ownerRegion || "").trim(),
        ownerGenre: String(band?.ownerGenre || "").trim(),
      }))
      .filter((band) => band.id);
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

  function createBandItem(band) {
    const item = document.createElement("article");
    const title = document.createElement("strong");
    const meta = document.createElement("p");
    const status = document.createElement("span");
    const metaParts = [
      band.ownerRegion,
      band.ownerGenre,
      `${band.memberCount}명`,
    ].filter(Boolean);

    item.className = "band-card";
    title.textContent = band.name;
    meta.textContent = band.description || metaParts.join(" · ") || "밴드 소개 준비 중";
    status.textContent = band.ownerName
      ? `${band.ownerName} 운영`
      : "구성된 밴드";

    item.append(title, meta, status);
    return item;
  }

  function renderBandEmptyState(titleText, descriptionText) {
    if (!bandList) {
      return;
    }

    const item = document.createElement("article");
    const title = document.createElement("strong");
    const description = document.createElement("p");

    item.className = "band-card band-card-empty";
    title.textContent = titleText;
    description.textContent = descriptionText;
    item.append(title, description);
    bandList.replaceChildren(item);
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
