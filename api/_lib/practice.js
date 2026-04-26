const MAX_PRACTICE_NOTE_LENGTH = 80;

function normalizePracticeLogs(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized = {};

  for (const [dateKey, entries] of Object.entries(value)) {
    const nextDateKey = normalizePracticeDateKey(dateKey);
    const nextEntries = normalizePracticeEntries(entries);

    if (!nextDateKey || !nextEntries.length) {
      continue;
    }

    normalized[nextDateKey] = nextEntries;
  }

  return normalized;
}

function normalizePracticeEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => normalizePracticeEntry(entry, index))
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function normalizePracticeEntry(value, index) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const minutes = Number(value.minutes);

  if (!Number.isInteger(minutes) || minutes <= 0) {
    return null;
  }

  return {
    id: normalizePracticeEntryId(value.id, index),
    minutes,
    note: normalizePracticeNote(value.note),
    createdAt: normalizePracticeTimestamp(value.createdAt),
  };
}

function normalizePracticeEntryId(value, index) {
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 120);
  }

  return `practice-${index + 1}`;
}

function normalizePracticeNote(value) {
  return String(value || "").trim().slice(0, MAX_PRACTICE_NOTE_LENGTH);
}

function normalizePracticeTimestamp(value) {
  const createdAt = new Date(value);

  if (Number.isNaN(createdAt.getTime())) {
    return new Date().toISOString();
  }

  return createdAt.toISOString();
}

function normalizePracticeDateKey(value) {
  const date = parseDateKey(value);

  if (!date) {
    return "";
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return null;
  }

  const [year, month, day] = String(value).split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

module.exports = {
  normalizePracticeLogs,
};
