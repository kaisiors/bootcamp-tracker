export const bootcampStorageKey = "bootcamp-spending-tracker:bootcamps";
export const selectedBootcampStorageKey =
  "bootcamp-spending-tracker:selected-bootcamp";

export function createBootcampFromDraft(draft, existingBootcamps = []) {
  const idBase = slugify(`${draft.name}-${draft.startDate}`);
  const usedIds = new Set(existingBootcamps.map((bootcamp) => bootcamp.id));
  let id = `bc-${idBase}`;
  let index = 2;

  while (usedIds.has(id)) {
    id = `bc-${idBase}-${index}`;
    index += 1;
  }

  return {
    id,
    name: draft.name.trim(),
    location: draft.location.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    paymentDeadline: normalizeDeadline(draft.paymentDeadline),
    status: draft.status ?? "active",
  };
}

export function mergeBootcamps(baseBootcamps, storedBootcamps) {
  const bootcampsById = new Map();
  const validStoredBootcamps = storedBootcamps.filter(isValidBootcamp);

  if (validStoredBootcamps.length > 0) {
    for (const bootcamp of validStoredBootcamps) {
      bootcampsById.set(bootcamp.id, bootcamp);
    }

    return Array.from(bootcampsById.values());
  }

  for (const bootcamp of baseBootcamps) {
    if (isValidBootcamp(bootcamp)) {
      bootcampsById.set(bootcamp.id, bootcamp);
    }
  }

  return Array.from(bootcampsById.values());
}

export function loadStoredBootcamps() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(bootcampStorageKey);
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed.filter(isValidBootcamp) : [];
  } catch {
    return [];
  }
}

export function saveStoredBootcamps(bootcamps) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(bootcampStorageKey, JSON.stringify(bootcamps));
}

export function loadSelectedBootcampId() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(selectedBootcampStorageKey);
}

export function saveSelectedBootcampId(bootcampId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(selectedBootcampStorageKey, bootcampId);
}

function normalizeDeadline(value) {
  if (value.includes("+")) {
    return value;
  }

  if (value.length === 16) {
    return `${value}:00+07:00`;
  }

  return value;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "bootcamp";
}

function isValidBootcamp(value) {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.location === "string" &&
      typeof value.startDate === "string" &&
      typeof value.endDate === "string" &&
      typeof value.paymentDeadline === "string" &&
      typeof value.status === "string",
  );
}
