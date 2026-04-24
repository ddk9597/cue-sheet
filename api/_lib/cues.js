const ACOUSTIC_TUNING_FIELD = "acousticTuning";
const ELECTRIC_TUNING_FIELD = "electricTuning";
const BASS_TUNING_FIELD = "bassTuning";
const TUNING_STANDARD = "standard";
const TUNING_HALF_DOWN = "half-down";
const TUNING_D_DROP = "d-drop";
const TUNING_INACTIVE = "inactive";

function normalizeCueList(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => normalizeCue(item, index))
    .filter(Boolean);
}

function normalizeCue(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const title = typeof item.title === "string"
    ? item.title.trim().slice(0, 60)
    : "";
  const seconds = Number(item.seconds);

  if (!title || !Number.isInteger(seconds) || seconds < 0) {
    return null;
  }

  return {
    id: normalizeCueId(item.id, index),
    title,
    bpm: normalizeBpm(item.bpm),
    seconds,
    acousticTuning: normalizeTuning(ACOUSTIC_TUNING_FIELD, item.acousticTuning),
    electricTuning: normalizeTuning(ELECTRIC_TUNING_FIELD, item.electricTuning),
    bassTuning: normalizeTuning(BASS_TUNING_FIELD, item.bassTuning),
  };
}

function normalizeCueId(value, index) {
  if (typeof value !== "string") {
    return `cue-${index + 1}`;
  }

  const normalized = value.trim();

  if (!normalized) {
    return `cue-${index + 1}`;
  }

  return normalized.slice(0, 120);
}

function normalizeBpm(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\D/g, "").slice(0, 3);
}

function normalizeTuning(field, value) {
  if (typeof value !== "string") {
    return TUNING_STANDARD;
  }

  const normalized = value.trim().toLowerCase();

  if (
    field === BASS_TUNING_FIELD &&
    (
      normalized === TUNING_D_DROP ||
      normalized === "d 드랍" ||
      normalized === "d드랍"
    )
  ) {
    return TUNING_D_DROP;
  }

  if (
    field !== ELECTRIC_TUNING_FIELD &&
    (
      normalized === TUNING_INACTIVE ||
      normalized === "참여 안함" ||
      normalized === "미참여"
    )
  ) {
    return TUNING_INACTIVE;
  }

  if (normalized === TUNING_HALF_DOWN || normalized === "하프다운") {
    return TUNING_HALF_DOWN;
  }

  return TUNING_STANDARD;
}

module.exports = {
  normalizeCueList,
};
